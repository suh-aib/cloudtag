import { Cloud, ChevronRight, Layers, ArrowRight, Tags } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { InventoryFilters } from "../../components/ui/InventoryFilters";
import type { InventoryFilters as APIFilters } from "../../services/api/inventory";
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getAzureResourceTypes, getProviderAccounts, type ResourceTypeCount } from "../../services/api/inventory";
import { TaskAssignmentBanner } from "../../components/tagging/TaskAssignmentBanner";
import { ConfirmAssignmentModal } from "../../components/tagging/ConfirmAssignmentModal";
import type { CreateAssignmentPayload } from "../../types/assignment";

export default function AzureResourceTypes() {
  const { subscription, resourceGroup } = useParams<{ subscription: string; resourceGroup: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignUserId = searchParams.get("assign_user_id");
  const taskId = searchParams.get("task_id");

  const { getToken, user } = useAuth();
  const [types, setTypes] = useState<ResourceTypeCount[]>([]);
  const [accountName, setAccountName] = useState<string>(subscription || '');
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<APIFilters>({ ...(taskId ? { task_id: parseInt(taskId, 10) } : {}) });

  const [assignPayload, setAssignPayload] = useState<CreateAssignmentPayload | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(types.map(t => t.resource_type)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectResource = (id: string, checked: boolean) => {
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

  const getQueryString = () => {
    const p = new URLSearchParams();
    if (assignUserId) p.append("assign_user_id", assignUserId);
    if (taskId) p.append("task_id", taskId);
    const s = p.toString();
    return s ? `?${s}` : "";
  };


  useEffect(() => {
    if (!subscription || !resourceGroup) return;
    setIsLoading(true);
    getToken().then(token => {
      if (token) {
        Promise.all([
          getAzureResourceTypes(token, subscription, resourceGroup, filters),
          getProviderAccounts(token, 'azure', filters)
        ])
          .then(([data, accountsData]) => {
            setTypes(data);
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
  }, [getToken, subscription, resourceGroup, filters]);

  const totalResources = types.reduce((acc, curr) => acc + curr.resource_count, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <TaskAssignmentBanner />
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to={`/azure${getQueryString()}`} className="hover:text-azure transition-colors flex items-center gap-1">
          <Cloud size={14} />
          Azure
        </Link>
        <ChevronRight size={14} />
        <Link to={`/azure/${encodeURIComponent(subscription || '')}${getQueryString()}`} className="hover:text-azure transition-colors truncate max-w-[200px]">
          {accountName}
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-gray-900 truncate max-w-[200px]">{resourceGroup}</span>
      </div>

      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Resource Types</h1>
          <p className="text-sm text-gray-500">Select a resource type to view individual resources.</p>
        </div>
        <div className="flex gap-4">
          <Card className="shadow-sm border-gray-200 min-w-[120px]">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center bg-gray-50/50">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Resource Types</span>
              <span className="text-2xl font-bold text-gray-900">{types.length}</span>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-gray-200 min-w-[120px]">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center bg-gray-50/50">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Resources</span>
              <span className="text-2xl font-bold text-gray-900">{totalResources}</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm mb-6 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div className="flex-1 w-full">
          <InventoryFilters 
            onFiltersChange={setFilters} 
            showLocationFilter={false}
            showResourceTypeFilter={true}
          />
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          <label className="flex items-center gap-2 text-sm text-gray-700 font-medium cursor-pointer">
            <input 
              type="checkbox" 
              className="rounded border-gray-300 text-azure focus:ring-azure cursor-pointer"
              checked={types.length > 0 && selectedIds.size === types.length}
              ref={input => {
                if (input) {
                  input.indeterminate = selectedIds.size > 0 && selectedIds.size < types.length;
                }
              }}
              onChange={handleSelectAll}
              disabled={isLoading || types.length === 0}
            />
            Select All
          </label>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-azure-light/30 px-3 py-1 rounded-md border border-azure/20">
              <span className="text-sm font-medium text-azure-dark">
                {selectedIds.size} selected
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 px-2 text-gray-500 hover:text-gray-900 text-xs">
                Clear
              </Button>
              {!assignUserId && (
                <Button 
                  size="sm" 
                  className="h-7 px-3 gap-1.5 bg-azure hover:bg-azure-dark text-xs" 
                  onClick={() => navigate(`/bulk-tagging/wizard?provider=AZURE&scopeType=RESOURCE_TYPE&accountId=${encodeURIComponent(subscription || '')}&resourceGroup=${encodeURIComponent(resourceGroup || '')}&resourceType=${encodeURIComponent(Array.from(selectedIds).join(','))}${taskId ? `&task_id=${taskId}` : ''}`)}
                >
                  <Tags size={14} /> Bulk Tag
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-gray-500">Loading resource types...</div>
      ) : types.length === 0 ? (
        <div className="py-16 text-center">
          <div className="flex flex-col items-center justify-center text-gray-400 space-y-3">
            <Layers size={48} className="text-azure/40" />
            <p className="text-sm font-medium text-gray-600">No resource types available</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {types.map((type) => (
            <Card key={type.resource_type} className={`border-gray-200 hover:shadow-md transition-shadow group relative ${selectedIds.has(type.resource_type) ? 'ring-2 ring-azure bg-azure-light/5' : ''}`}>
              <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-azure focus:ring-azure h-4 w-4 bg-white cursor-pointer"
                  checked={selectedIds.has(type.resource_type)}
                  onChange={(e) => handleSelectResource(type.resource_type, e.target.checked)}
                />
              </div>
              <Link to={`/azure/${encodeURIComponent(subscription || '')}/${encodeURIComponent(resourceGroup || '')}/${encodeURIComponent(type.resource_type)}${getQueryString()}`}>
                <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">{type.display_name}</h3>
                    <p className="text-xs text-gray-500 font-mono truncate mb-2">{type.resource_type}</p>
                    <div className="flex gap-2 mb-2">
                      {type.billability && (
                        <Badge variant={type.billability === 'BILLABLE' ? 'success' : type.billability === 'NON_BILLABLE' ? 'secondary' : 'warning'}>
                          {type.billability}
                        </Badge>
                      )}
                      {type.tagging_scope && (
                        <Badge variant={type.tagging_scope === 'REQUIRED' ? 'destructive' : type.tagging_scope === 'SUPPORTING' ? 'secondary' : 'outline'}>
                          {type.tagging_scope}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-azure-light text-azure">
                      {type.resource_count} resources
                    </span>
                    <div className="flex items-center gap-1">
                      {user?.role === "ADMIN" && assignUserId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs border-azure-200 text-azure hover:bg-azure-50"
                          onClick={(e) => {
                            e.preventDefault();
                            setAssignPayload({
                              provider: "AZURE",
                              scope_type: "RESOURCE_TYPE",
                              subscription_id: subscription || '',
                              resource_group: resourceGroup || '',
                              resource_type: type.resource_type,
                              assigned_user_id: parseInt(assignUserId)
                            });
                          }}
                        >
                          Assign Task
                        </Button>
                      )}

                      <Button variant="ghost" size="icon" className="h-8 w-8 text-azure opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight size={18} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}

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
