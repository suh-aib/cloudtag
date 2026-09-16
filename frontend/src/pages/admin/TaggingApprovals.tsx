import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Cloud, ArrowRight, ChevronDown, ChevronRight, Activity, CheckCircle, Terminal } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { getApprovalQueue, getApprovedWork } from "../../services/api/approvals";
import { generateScriptJob } from "../../services/api/scripts";
import { useAuth } from "../../contexts/AuthContext";
import { type BatchResponse } from "../../services/api/tagging";

interface GroupedQueue {
  key: string;
  user: string;
  cloud: string;
  scope: string;
  totalResources: number;
  batches: BatchResponse[];
  status: string;
}

const renderStatus = (status: string) => {
  switch (status) {
    case 'APPROVED': return <Badge variant="success">Approved</Badge>;
    case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>;
    case 'PARTIALLY_APPROVED': return <Badge variant="warning">Partial</Badge>;
    default: return <Badge variant="secondary">Pending</Badge>;
  }
};

function PendingApprovalTab() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadBatches() {
      try {
        const token = await getToken();
        if (token) {
          const data = await getApprovalQueue(token);
          setBatches(data);
        }
      } catch (err) {
        console.error("Failed to load approval queue", err);
      } finally {
        setLoading(false);
      }
    }
    loadBatches();
  }, [getToken]);

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const grouped = useMemo(() => {
    const groups: Record<string, GroupedQueue> = {};
    batches.forEach(b => {
      const key = `${b.created_by_name}-${b.cloud}-${b.scope}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          user: b.created_by_name || "Unknown",
          cloud: b.cloud,
          scope: b.scope || "Global",
          totalResources: 0,
          batches: [],
          status: 'PENDING_APPROVAL'
        };
      }
      groups[key].batches.push(b);
      groups[key].totalResources += (b.resource_count || 0);
      if (b.status === 'PARTIALLY_APPROVED') {
        groups[key].status = 'PARTIALLY_APPROVED';
      }
    });
    return Object.values(groups);
  }, [batches]);

  return (
    <Card className="shadow-sm border-gray-200 mt-6">
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading approval queue...</div>
        ) : grouped.length === 0 ? (
          <EmptyState 
            icon={<Activity size={48} />}
            title="Queue is empty"
            description="There are no pending tagging submissions awaiting your review."
            className="border-0 bg-transparent py-24"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Cloud</TableHead>
                  <TableHead>Subscription / Account</TableHead>
                  <TableHead>Total Resources</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map((group) => {
                  const isExpanded = expanded[group.key];
                  return (
                    <React.Fragment key={group.key}>
                      <TableRow className="bg-gray-50/50 hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(group.key)}>
                        <TableCell className="p-2 w-8">
                          {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">{group.user}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-medium">
                            <Cloud size={14} className={group.cloud === 'AZURE' ? 'text-blue-600' : 'text-orange-500'} />
                            {group.cloud}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-gray-800">{group.scope}</TableCell>
                        <TableCell className="text-gray-700">{group.totalResources}</TableCell>
                        <TableCell>{renderStatus(group.status)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0 bg-white border-b-2 border-gray-100">
                            <div className="pl-12 pr-4 py-3 space-y-2">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Submission History</h4>
                              <div className="divide-y divide-gray-100 border rounded-md">
                                {group.batches.map(batch => (
                                  <div key={batch.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                    <div className="flex items-center gap-4">
                                      <div className="text-xs font-mono font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">{batch.batch_id}</div>
                                      <div className="text-sm text-gray-600">{new Date(batch.created_at).toLocaleString()}</div>
                                      <div className="text-sm font-medium text-gray-900">{batch.resource_count} resources</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      {renderStatus(batch.status)}
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/admin/tagging-approvals/${batch.batch_id}`);
                                        }}
                                        className="inline-flex items-center gap-1 text-sm font-semibold text-azure hover:text-azure-dark"
                                      >
                                        Review <ArrowRight size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApprovedWorkTab() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    async function loadBatches() {
      try {
        const token = await getToken();
        if (token) {
          const data = await getApprovedWork(token);
          setBatches(data);
        }
      } catch (err) {
        console.error("Failed to load approved work", err);
      } finally {
        setLoading(false);
      }
    }
    loadBatches();
  }, [getToken]);

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const grouped = useMemo(() => {
    const groups: Record<string, GroupedQueue> = {};
    batches.forEach(b => {
      const key = `${b.created_by_name}-${b.cloud}-${b.scope}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          user: b.created_by_name || "Unknown",
          cloud: b.cloud,
          scope: b.scope || "Global",
          totalResources: 0,
          batches: [],
          status: 'APPROVED'
        };
      }
      groups[key].batches.push(b);
      groups[key].totalResources += (b.resource_count || 0);
      if (b.status === 'PARTIALLY_APPROVED') {
        groups[key].status = 'PARTIALLY_APPROVED';
      }
    });
    return Object.values(groups);
  }, [batches]);

  const handleGenerateScript = async (e: React.MouseEvent, group: GroupedQueue) => {
    e.stopPropagation();
    setGenerating(group.key);
    try {
      const token = await getToken();
      if (!token) throw new Error("No token");
      await generateScriptJob(token, group.cloud, group.scope);
      navigate('/admin/script-generation');
    } catch (err: any) {
      alert(`Error generating script: ${err.message}`);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <Card className="shadow-sm border-gray-200 mt-6">
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading approved work...</div>
        ) : grouped.length === 0 ? (
          <EmptyState 
            icon={<CheckCircle size={48} />}
            title="No approved work"
            description="There are no approved tagging submissions yet."
            className="border-0 bg-transparent py-24"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Cloud</TableHead>
                  <TableHead>Subscription / Account</TableHead>
                  <TableHead>Total Resources</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map((group) => {
                  const isExpanded = expanded[group.key];
                  return (
                    <React.Fragment key={group.key}>
                      <TableRow className="bg-gray-50/50 hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(group.key)}>
                        <TableCell className="p-2 w-8">
                          {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">{group.user}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-medium">
                            <Cloud size={14} className={group.cloud === 'AZURE' ? 'text-blue-600' : 'text-orange-500'} />
                            {group.cloud}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-gray-800">{group.scope}</TableCell>
                        <TableCell className="text-gray-700">{group.totalResources}</TableCell>
                        <TableCell>{renderStatus(group.status)}</TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={(e) => handleGenerateScript(e, group)}
                            disabled={generating === group.key}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-azure rounded hover:bg-azure-dark disabled:opacity-50"
                          >
                            <Terminal size={14} />
                            {generating === group.key ? "Generating..." : "Generate Script"}
                          </button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-0 bg-white border-b-2 border-gray-100">
                            <div className="pl-12 pr-4 py-3 space-y-2">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Submission History</h4>
                              <div className="divide-y divide-gray-100 border rounded-md">
                                {group.batches.map(batch => (
                                  <div key={batch.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                    <div className="flex items-center gap-4">
                                      <div className="text-xs font-mono font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">{batch.batch_id}</div>
                                      <div className="text-sm text-gray-600">{new Date(batch.created_at).toLocaleString()}</div>
                                      <div className="text-sm font-medium text-gray-900">{batch.resource_count} resources</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      {renderStatus(batch.status)}
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/admin/tagging-approvals/${batch.batch_id}`);
                                        }}
                                        className="inline-flex items-center gap-1 text-sm font-semibold text-azure hover:text-azure-dark"
                                      >
                                        View <ArrowRight size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TaggingApprovals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "pending";

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tagging Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">Review pending bulk tagging proposals and generate scripts from approved work.</p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setSearchParams({ tab: "pending" })}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "pending"
                ? "border-azure text-azure"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Pending Approval
          </button>
          <button
            onClick={() => setSearchParams({ tab: "approved" })}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "approved"
                ? "border-azure text-azure"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Approved Work
          </button>
        </nav>
      </div>

      {currentTab === "pending" ? <PendingApprovalTab /> : <ApprovedWorkTab />}
    </div>
  );
}
