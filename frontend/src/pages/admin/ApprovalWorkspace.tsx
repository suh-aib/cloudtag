import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../../contexts/AuthContext";
import { getBatchHierarchy, decideBatchApproval, type BatchApprovalDetail, type ChangeDetail } from "../../services/api/approvals";

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

export default function ApprovalWorkspace() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [batch, setBatch] = useState<BatchApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const loadData = async () => {
    try {
      const token = await getToken();
      if (!token || !batchId) return;
      setLoading(true);
      const data = await getBatchHierarchy(token, batchId);
      setBatch(data);
    } catch (err) {
      console.error(err);
      alert("Failed to load batch approval details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [batchId]);

  const handleDecide = async (scopeType: string, scopeValue: string, action: string, accountId?: string, resourceGroup?: string, region?: string) => {
    try {
      const token = await getToken();
      if (!token || !batchId) return;
      await decideBatchApproval(token, batchId, {
        scope_type: scopeType,
        scope_value: scopeValue,
        action,
        account_id: accountId,
        resource_group: resourceGroup,
        region: region
      });
      await loadData();
    } catch (err) {
      console.error(err);
      alert(`Failed to ${action.toLowerCase()} items.`);
    }
  };

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

  if (loading || !batch || !hierarchy) {
    return <div className="p-12 text-center text-gray-500">Loading workspace...</div>;
  }

  const renderStatus = (status: string) => {
    switch (status) {
      case 'APPROVED': return <Badge variant="success">Approved</Badge>;
      case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>;
      case 'PARTIALLY_APPROVED': return <Badge variant="warning">Partial</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const DecisionButtons = ({ scope, value, accountId, rgName, region }: { scope: string, value: string, accountId?: string, rgName?: string, region?: string }) => (
    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
      <Button size="sm" variant="outline" className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200" onClick={() => handleDecide(scope, value, "APPROVE", accountId, rgName, region)}>
        <Check size={14} className="mr-1" /> Approve
      </Button>
      <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => handleDecide(scope, value, "REJECT", accountId, rgName, region)}>
        <X size={14} className="mr-1" /> Reject
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/approvals')}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Approval Review</h1>
        </div>
        <div className="ml-auto">
          {batch.status === 'PENDING_APPROVAL' && <DecisionButtons scope="BATCH" value={batch.batch_id} />}
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50">
          <div>
            <span className="text-gray-500 block">Submitted by:</span>
            <span className="font-medium text-gray-900">{batch.submitted_by}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Cloud:</span>
            <span className="font-medium text-gray-900">{batch.cloud}</span>
          </div>
          <div>
            <span className="text-gray-500 block">{batch.cloud === 'AWS' ? 'Account:' : 'Subscription:'}</span>
            <span className="font-medium text-gray-900">{batch.scope}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Submitted:</span>
            <span className="font-medium text-gray-900">{new Date(batch.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Total Resources:</span>
            <span className="font-medium text-gray-900">{new Set(batch.changes.map(c => c.resource_id)).size}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Proposed Changes:</span>
            <span className="font-medium text-gray-900">{batch.changes.length}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Submission ID:</span>
            <span className="font-medium text-gray-900 font-mono text-xs">{batch.batch_id}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Status:</span>
            {renderStatus(batch.status)}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {Object.values(hierarchy).map(acc => {
              const accKey = `acc-${acc.id}`;
              const accExpanded = expanded[accKey] !== false; // default expanded
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
                      {acc.status === 'PENDING_APPROVAL' && <DecisionButtons scope="ACCOUNT" value={acc.id} />}
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
                                <span className="font-medium text-gray-800">
                                  {batch.cloud === 'AWS' ? 'Region' : 'Resource Group'}: {grp.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-4">
                                {renderStatus(grp.status)}
                                {grp.status === 'PENDING_APPROVAL' && <DecisionButtons scope={batch.cloud === 'AWS' ? "REGION" : "RESOURCE_GROUP"} value={grp.name} accountId={acc.id} />}
                              </div>
                            </div>

                            {grpExpanded && (
                              <div className="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50/30">
                                {Object.values(grp.types).map(typ => {
                                  const typKey = `${grpKey}-typ-${typ.name}`;
                                  const typExpanded = expanded[typKey]; // default collapsed
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
                                          {typ.status === 'PENDING_APPROVAL' && <DecisionButtons scope="RESOURCE_TYPE" value={typ.name} accountId={acc.id} rgName={batch.cloud === 'AWS' ? undefined : grp.name} region={batch.cloud === 'AWS' ? grp.name : undefined} />}
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
                                                  {res.status === 'PENDING_APPROVAL' && <DecisionButtons scope="RESOURCE" value={res.id.toString()} />}
                                                </div>
                                              </div>
                                              <div className="space-y-1">
                                                {res.changes.map(change => (
                                                  <div key={change.id} className={`flex items-center justify-between pl-4 pr-2 py-1.5 rounded text-sm ${change.status === 'REJECTED' ? 'bg-red-50 opacity-60' : 'bg-gray-50'}`}>
                                                    <div className="flex items-center gap-3">
                                                      <span className="font-mono text-xs font-semibold w-32">{change.tag_key}</span>
                                                      <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-gray-500 line-through">{change.previous_value || 'None'}</span>
                                                        <ArrowLeft size={12} className="text-gray-400 rotate-180" />
                                                        <span className="font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">{change.proposed_value}</span>
                                                      </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                      {renderStatus(change.status)}
                                                      {change.status === 'PENDING_APPROVAL' && (
                                                        <div className="flex items-center gap-1">
                                                          <button onClick={() => handleDecide("CHANGE", change.id.toString(), "APPROVE")} className="p-1 hover:bg-green-100 text-green-600 rounded"><Check size={14}/></button>
                                                          <button onClick={() => handleDecide("CHANGE", change.id.toString(), "REJECT")} className="p-1 hover:bg-red-100 text-red-600 rounded"><X size={14}/></button>
                                                        </div>
                                                      )}
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
