import { useState, useEffect } from "react";
import { Cloud, ChevronRight, Server, Tags, UserPlus } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { InventoryFilters } from "../../components/ui/InventoryFilters";
import type { InventoryFilters as APIFilters } from "../../services/api/inventory";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getAzureResources, getProviderAccounts, type ResourceDetail } from "../../services/api/inventory";
import { TaskAssignmentBanner } from "../../components/tagging/TaskAssignmentBanner";
import { ConfirmAssignmentModal } from "../../components/tagging/ConfirmAssignmentModal";
import type { CreateAssignmentPayload } from "../../types/assignment";

export default function AzureResourceList() {
  const { subscription, resourceGroup, resourceType } = useParams<{ subscription: string; resourceGroup: string; resourceType: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignUserId = searchParams.get("assign_user_id");
  const taskId = searchParams.get("task_id");

  const { getToken, user } = useAuth();
  const [resources, setResources] = useState<ResourceDetail[]>([]);
  const [accountName, setAccountName] = useState<string>(subscription || '');
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<APIFilters>({ ...(taskId ? { task_id: parseInt(taskId, 10) } : {}) });

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [assignPayload, setAssignPayload] = useState<CreateAssignmentPayload | null>(null);

  const getQueryString = () => {
    const p = new URLSearchParams();
    if (assignUserId) p.append("assign_user_id", assignUserId);
    if (taskId) p.append("task_id", taskId);
    const s = p.toString();
    return s ? `?${s}` : "";
  };


  const handleOpenAssignSelected = () => {
    if (!assignUserId) return;
    setAssignPayload({
      provider: "AZURE",
      scope_type: "RESOURCE_SELECTION",
      resource_ids: Array.from(selectedIds).map(String),
      assigned_user_id: parseInt(assignUserId)
    });
  };

  useEffect(() => {
    if (!subscription || !resourceGroup || !resourceType) return;
    setIsLoading(true);
    getToken().then(token => {
      if (token) {
        Promise.all([
          getAzureResources(token, subscription, resourceGroup, resourceType),
          getProviderAccounts(token, 'azure', filters)
        ])
          .then(([data, accountsData]) => {
            setResources(data);
            const acc = accountsData.find(a => a.account_identifier === subscription);
            if (acc && acc.account_name) {
              setAccountName(acc.account_name);
            }
          })
          .catch(console.error)
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });
  }, [getToken, subscription, resourceGroup, resourceType]);

  const displayType = resourceType ? (resourceType.split('/').pop() || resourceType) : '';

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(resources.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectResource = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto py-2">
      <TaskAssignmentBanner />
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to={`/azure${getQueryString()}`} className="hover:text-azure transition-colors flex items-center gap-1">
          <Cloud size={14} />
          Azure
        </Link>
        <ChevronRight size={14} />
        <Link to={`/azure/${encodeURIComponent(subscription || '')}${getQueryString()}`} className="hover:text-azure transition-colors truncate max-w-[150px]">
          {accountName}
        </Link>
        <ChevronRight size={14} />
        <Link to={`/azure/${encodeURIComponent(subscription || '')}/${encodeURIComponent(resourceGroup || '')}${getQueryString()}`} className="hover:text-azure transition-colors truncate max-w-[150px]">
          {resourceGroup}
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-gray-900 truncate max-w-[150px]">{displayType}</span>
      </div>

      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{displayType}</h1>
          <p className="text-sm text-gray-500 font-mono">{resourceType}</p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="shadow-sm border-gray-200 min-w-[120px]">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center bg-gray-50/50">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Resources</span>
              <span className="text-2xl font-bold text-gray-900">{resources.length}</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex-1">
            <InventoryFilters 
              onFiltersChange={setFilters} 
              showLocationFilter={false}
              showResourceTypeFilter={true}
            />
          </div>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 bg-azure-light/30 px-4 py-1 rounded-md border border-azure/20">
              <span className="text-sm font-medium text-azure-dark">
                Selected: {selectedIds.size} resources
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 text-gray-500 hover:text-gray-900">
                Clear
              </Button>
              {user?.role === "ADMIN" && assignUserId && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 gap-2 bg-white text-gray-700 border-azure/30 hover:bg-azure/5"
                  onClick={handleOpenAssignSelected}
                >
                  <UserPlus size={16} className="text-azure" /> Assign Selected
                </Button>
              )}
              {!assignUserId && (
                <Button size="sm" className="h-8 gap-2 bg-azure hover:bg-azure-dark" onClick={() => navigate(`/bulk-tagging/wizard?provider=AZURE&scopeType=RESOURCE_SELECTION&resourceIds=${Array.from(selectedIds).join(',')}${taskId ? `&task_id=${taskId}` : ''}`)}>
                  <Tags size={16} /> Bulk Tag
                </Button>
              )}
            </div>
          )}
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-azure focus:ring-azure"
                      checked={resources.length > 0 && selectedIds.size === resources.length}
                      ref={input => {
                        if (input) {
                          input.indeterminate = selectedIds.size > 0 && selectedIds.size < resources.length;
                        }
                      }}
                      onChange={handleSelectAll}
                      disabled={isLoading || resources.length === 0}
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-gray-700">Resource Name</TableHead>
                  <TableHead className="font-semibold text-gray-700">Resource ID</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-center">Billable</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-center">Tagging Scope</TableHead>
                  <TableHead className="font-semibold text-gray-700">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center text-gray-500">
                      Loading resources...
                    </TableCell>
                  </TableRow>
                ) : resources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400 space-y-3">
                        <Server size={48} className="text-azure/40" />
                        <p className="text-sm font-medium text-gray-600">No resources available</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  resources.map(res => (
                    <TableRow key={res.resource_id} className={`hover:bg-gray-50/50 ${selectedIds.has(res.id) ? 'bg-azure-light/20' : ''}`}>
                      <TableCell className="text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-azure focus:ring-azure"
                          checked={selectedIds.has(res.id)}
                          onChange={(e) => handleSelectResource(res.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900 truncate max-w-sm" title={res.resource_name}>
                          {res.resource_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-400 font-mono truncate max-w-sm" title={res.resource_id}>
                          {res.resource_id.split('/').pop() || res.resource_id}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {res.billability && (
                          <Badge variant={res.billability === 'BILLABLE' ? 'success' : res.billability === 'NON_BILLABLE' ? 'secondary' : 'warning'}>
                            {res.billability}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          res.tagging_scope === 'REQUIRED' ? 'bg-amber-100 text-amber-800' :
                          res.tagging_scope === 'SUPPORTING' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {res.tagging_scope}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          {res.status.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap">
                        {user?.role === "ADMIN" && assignUserId && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-azure hover:bg-azure-light"
                            onClick={() => setAssignPayload({
                              provider: "AZURE",
                              scope_type: "RESOURCE_SELECTION",
                              resource_ids: [String(res.id)],
                              assigned_user_id: parseInt(assignUserId)
                            })}
                          >
                            Assign
                          </Button>
                        )}
                        {!assignUserId && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-azure hover:bg-azure-light"
                            onClick={() => {
                              navigate(`/bulk-tagging/wizard?provider=AZURE&scopeType=RESOURCE_SELECTION&resourceIds=${res.id}${taskId ? `&task_id=${taskId}` : ''}`);
                            }}
                          >
                            Tag
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {assignPayload && assignUserId && (
        <ConfirmAssignmentModal
          isOpen={!!assignPayload}
          onClose={() => setAssignPayload(null)}
          assignUserId={assignUserId}
          payload={assignPayload}
        />
      )}
    </div>
  );
}
