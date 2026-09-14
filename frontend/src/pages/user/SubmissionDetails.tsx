import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../../contexts/AuthContext";
import { getBatchHierarchy, type BatchApprovalDetail, type ChangeDetail } from "../../services/api/approvals";

interface ResourceNode {
  id: number;
  name: string;
  changes: ChangeDetail[];
  status: string;
}

interface TypeNode {
  name: string;
  resources: ResourceNode[];
  status: string;
}

interface GroupNode {
  name: string;
  types: Record<string, TypeNode>;
  status: string;
}

interface AccountNode {
  id: string;
  name: string;
  groups: Record<string, GroupNode>;
  status: string;
}

export default function SubmissionDetails() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [batch, setBatch] = useState<BatchApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const loadData = async () => {
    try {
      const token = await getToken();
      if (!token || !batchId) {
        setError("Authentication required.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const data = await getBatchHierarchy(token, batchId);
      setBatch(data);
    } catch (err: any) {
      console.error(err);
      if (err?.response?.status === 404) {
        setError("Submission not found.");
      } else {
        setError("Failed to load submission details.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [batchId]);

  const hierarchy = useMemo(() => {
    if (!batch) return null;
    
    const accounts: Record<string, AccountNode> = {};
    
    batch.changes.forEach(change => {
      const accId = change.account_id_str;
      if (!accounts[accId]) {
        accounts[accId] = { id: accId, name: change.account_name, groups: {}, status: 'PENDING_APPROVAL' };
      }
      
      const acc = accounts[accId];
      const rgName = change.resource_group || "No Group";
      if (!acc.groups[rgName]) {
        acc.groups[rgName] = { name: rgName, types: {}, status: 'PENDING_APPROVAL' };
      }
      
      const group = acc.groups[rgName];
      const typeName = change.resource_type;
      if (!group.types[typeName]) {
        group.types[typeName] = { name: typeName, resources: [], status: 'PENDING_APPROVAL' };
      }
      
      const type = group.types[typeName];
      let res = type.resources.find(r => r.id === change.resource_id);
      if (!res) {
        res = { id: change.resource_id, name: change.resource_name, changes: [], status: 'PENDING_APPROVAL' };
        type.resources.push(res);
      }
      
      res.changes.push(change);
    });

    // Compute statuses bottom-up
    Object.values(accounts).forEach(acc => {
      let accStatuses = new Set<string>();
      Object.values(acc.groups).forEach(grp => {
        let grpStatuses = new Set<string>();
        Object.values(grp.types).forEach(typ => {
          let typStatuses = new Set<string>();
          typ.resources.forEach(res => {
            const resStatuses = new Set(res.changes.map(c => c.status));
            res.status = resStatuses.has('PENDING_APPROVAL') ? 'PENDING_APPROVAL' : 
                         (resStatuses.size === 1 ? Array.from(resStatuses)[0] : 'PARTIALLY_APPROVED');
            typStatuses.add(res.status);
          });
          typ.status = typStatuses.has('PENDING_APPROVAL') ? 'PENDING_APPROVAL' : 
                       (typStatuses.size === 1 ? Array.from(typStatuses)[0] : 'PARTIALLY_APPROVED');
          grpStatuses.add(typ.status);
        });
        grp.status = grpStatuses.has('PENDING_APPROVAL') ? 'PENDING_APPROVAL' : 
                     (grpStatuses.size === 1 ? Array.from(grpStatuses)[0] : 'PARTIALLY_APPROVED');
        accStatuses.add(grp.status);
      });
      acc.status = accStatuses.has('PENDING_APPROVAL') ? 'PENDING_APPROVAL' : 
                   (accStatuses.size === 1 ? Array.from(accStatuses)[0] : 'PARTIALLY_APPROVED');
    });

    return accounts;
  }, [batch]);

  if (loading) {
    return <div className="p-12 text-center text-gray-500">Loading submission...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/my-submissions')} className="mb-4">
          <ArrowLeft size={16} className="mr-2" /> Back
        </Button>
        <Card className="shadow-sm border-red-200 bg-red-50">
          <CardContent className="p-12 text-center text-red-600 font-medium">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!batch || !hierarchy) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/my-submissions')} className="mb-4">
          <ArrowLeft size={16} className="mr-2" /> Back
        </Button>
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-12 text-center text-gray-500 font-medium">
            Submission not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderStatus = (status: string) => {
    switch (status) {
      case 'APPROVED': return <Badge variant="success">Approved</Badge>;
      case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>;
      case 'PARTIALLY_APPROVED': return <Badge variant="warning">Partial</Badge>;
      case 'DRAFT': return <Badge variant="secondary">Draft</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/my-submissions')}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Submission Details</h1>
          <p className="text-sm text-gray-500">Submission ID: {batch.batch_id}</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right mr-4">
            <div className="text-sm font-medium">{batch.changes.length} tags across {new Set(batch.changes.map(c => c.resource_id)).size} resources</div>
            <div className="text-xs text-gray-500">Cloud: {batch.cloud} | Scope: {batch.scope}</div>
          </div>
          {renderStatus(batch.status)}
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {Object.values(hierarchy).map(acc => {
              const accKey = `acc-${acc.id}`;
              const accExpanded = expanded[accKey] !== false;
              return (
                <div key={acc.id} className="bg-white">
                  <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer border-l-4 border-l-blue-500" onClick={() => toggleExpand(accKey)}>
                    <div className="flex items-center gap-2">
                      {accExpanded ? <ChevronDown size={18} className="text-gray-500"/> : <ChevronRight size={18} className="text-gray-500"/>}
                      <span className="font-semibold text-gray-900">Account: {acc.name}</span>
                      <span className="text-xs text-gray-500 font-mono">({acc.id})</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {renderStatus(acc.status)}
                    </div>
                  </div>
                  
                  {accExpanded && (
                    <div className="divide-y divide-gray-100 border-t border-gray-100">
                      {Object.values(acc.groups).map(grp => {
                        const grpKey = `${accKey}-grp-${grp.name}`;
                        const grpExpanded = expanded[grpKey] !== false;
                        return (
                          <div key={grp.name}>
                            <div className="flex items-center justify-between p-3 pl-10 bg-white hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(grpKey)}>
                              <div className="flex items-center gap-2">
                                {grpExpanded ? <ChevronDown size={16} className="text-gray-500"/> : <ChevronRight size={16} className="text-gray-500"/>}
                                <span className="font-medium text-gray-800">Resource Group: {grp.name}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                {renderStatus(grp.status)}
                              </div>
                            </div>

                            {grpExpanded && (
                              <div className="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50/30">
                                {Object.values(grp.types).map(typ => {
                                  const typKey = `${grpKey}-typ-${typ.name}`;
                                  const typExpanded = expanded[typKey];
                                  return (
                                    <div key={typ.name}>
                                      <div className="flex items-center justify-between p-2 pl-16 hover:bg-gray-100 cursor-pointer" onClick={() => toggleExpand(typKey)}>
                                        <div className="flex items-center gap-2">
                                          {typExpanded ? <ChevronDown size={16} className="text-gray-500"/> : <ChevronRight size={16} className="text-gray-500"/>}
                                          <span className="text-sm font-medium text-gray-700">Type: {typ.name}</span>
                                          <span className="text-xs text-gray-500">({typ.resources.length} resources)</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          {renderStatus(typ.status)}
                                        </div>
                                      </div>

                                      {typExpanded && (
                                        <div className="border-t border-gray-100 bg-white">
                                          {typ.resources.map(res => (
                                            <div key={res.id} className="p-3 pl-24 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                              <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-medium text-gray-900">{res.name}</span>
                                                  <span className="text-xs text-gray-400 font-mono">ID: {res.id}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                  {renderStatus(res.status)}
                                                </div>
                                              </div>
                                              <div className="space-y-1">
                                                {res.changes.map(change => (
                                                  <div key={change.id} className={`flex items-center justify-between pl-4 pr-2 py-1.5 rounded text-sm ${change.status === 'REJECTED' ? 'bg-red-50 opacity-60' : 'bg-gray-50'}`}>
                                                    <div className="flex items-center gap-3">
                                                      <span className="font-mono text-xs font-semibold w-32">{change.tag_key}</span>
                                                      <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-gray-500 line-through">{change.previous_value || 'None'}</span>
                                                        <ArrowRight size={12} className="text-gray-400" />
                                                        <span className="font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">{change.proposed_value}</span>
                                                      </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                      {renderStatus(change.status)}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
