import { Cloud, ChevronRight, Layers, ArrowRight } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { InventoryFilters } from "../../components/ui/InventoryFilters";
import type { InventoryFilters as APIFilters } from "../../services/api/inventory";
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getAWSResourceTypes, getProviderAccounts, type ResourceTypeCount } from "../../services/api/inventory";
import { TaskAssignmentBanner } from "../../components/tagging/TaskAssignmentBanner";
import { ConfirmAssignmentModal } from "../../components/tagging/ConfirmAssignmentModal";
import type { CreateAssignmentPayload } from "../../types/assignment";

export default function AWSTypes() {
  const { accountId, region } = useParams<{ accountId: string; region: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignUserId = searchParams.get("assign_user_id");
  const taskId = searchParams.get("task_id");

  const { getToken, user } = useAuth();
  const [types, setTypes] = useState<ResourceTypeCount[]>([]);
  const [accountName, setAccountName] = useState<string>(accountId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<APIFilters>({ ...(taskId ? { task_id: parseInt(taskId, 10) } : {}) });

  const [assignPayload, setAssignPayload] = useState<CreateAssignmentPayload | null>(null);

  const getQueryString = () => {
    const p = new URLSearchParams();
    if (assignUserId) p.append("assign_user_id", assignUserId);
    if (taskId) p.append("task_id", taskId);
    const s = p.toString();
    return s ? `?${s}` : "";
  };


  useEffect(() => {
    if (!accountId || !region) return;
    setIsLoading(true);
    getToken().then(token => {
      if (token) {
        Promise.all([
          getAWSResourceTypes(token, accountId, region, filters),
          getProviderAccounts(token, 'aws', filters)
        ])
          .then(([data, accountsData]) => {
            setTypes(data);
            const acc = accountsData.find(a => a.account_identifier === accountId);
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
  }, [getToken, accountId, region, filters]);

  const totalResources = types.reduce((acc, curr) => acc + curr.resource_count, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <TaskAssignmentBanner />
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to={`/aws${getQueryString()}`} className="hover:text-aws transition-colors flex items-center gap-1">
          <Cloud size={14} />
          AWS
        </Link>
        <ChevronRight size={14} />
        <Link to={`/aws/${encodeURIComponent(accountId || '')}${getQueryString()}`} className="hover:text-aws transition-colors truncate max-w-[200px]">
          {accountName}
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-gray-900 truncate max-w-[200px]">{region}</span>
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

      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm mb-6">
        <InventoryFilters 
          onFiltersChange={setFilters} 
          showLocationFilter={false}
          showResourceTypeFilter={true}
        />
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-gray-500">Loading resource types...</div>
      ) : types.length === 0 ? (
        <div className="py-16 text-center">
          <div className="flex flex-col items-center justify-center text-gray-400 space-y-3">
            <Layers size={48} className="text-aws/40" />
            <p className="text-sm font-medium text-gray-600">No resource types available</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {types.map((type) => (
            <Card key={type.resource_type} className="border-gray-200 hover:shadow-md transition-shadow group">
              <Link to={`/aws/${encodeURIComponent(accountId || '')}/${encodeURIComponent(region || '')}/${encodeURIComponent(type.resource_type)}${getQueryString()}`}>
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
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-aws-light text-aws">
                      {type.resource_count} resources
                    </span>
                    <div className="flex items-center gap-1">
                      {user?.role === "ADMIN" && assignUserId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs border-aws-200 text-aws hover:bg-aws-50"
                          onClick={(e) => {
                            e.preventDefault();
                            setAssignPayload({
                              provider: "AWS",
                              scope_type: "RESOURCE_TYPE",
                              account_id: accountId || '',
                              region_id: region || '',
                              resource_type: type.resource_type,
                              assigned_user_id: parseInt(assignUserId)
                            });
                          }}
                        >
                          Assign Task
                        </Button>
                      )}
                      {!assignUserId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/bulk-tagging/wizard?provider=AWS&scopeType=RESOURCE_TYPE&accountId=${encodeURIComponent(accountId || '')}&region=${encodeURIComponent(region || '')}&resourceType=${encodeURIComponent(type.resource_type)}${taskId ? `&task_id=${taskId}` : ''}`);
                          }}
                        >
                          Bulk Tag
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-aws opacity-0 group-hover:opacity-100 transition-opacity">
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
