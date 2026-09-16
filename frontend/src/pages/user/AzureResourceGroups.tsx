import { Cloud, ChevronRight, Folder, Tags } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { InventoryFilters } from "../../components/ui/InventoryFilters";
import type { InventoryFilters as APIFilters } from "../../services/api/inventory";
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getAzureResourceGroups, getProviderAccounts, type ResourceGroupCount } from "../../services/api/inventory";
import { TaskAssignmentBanner } from "../../components/tagging/TaskAssignmentBanner";
import { ConfirmAssignmentModal } from "../../components/tagging/ConfirmAssignmentModal";
import type { CreateAssignmentPayload } from "../../types/assignment";

export default function AzureResourceGroups() {
  const { subscription } = useParams<{ subscription: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignUserId = searchParams.get("assign_user_id");
  const taskId = searchParams.get("task_id");

  const { getToken, user } = useAuth();
  const [groups, setGroups] = useState<ResourceGroupCount[]>([]);
  const [accountName, setAccountName] = useState<string>(subscription || '');
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<APIFilters>({ ...(taskId ? { task_id: parseInt(taskId, 10) } : {}) });

  const [assignPayload, setAssignPayload] = useState<CreateAssignmentPayload | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(groups.map(g => g.name)));
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
    if (!subscription) return;
    setIsLoading(true);
    getToken().then(token => {
      if (token) {

        Promise.all([
          getAzureResourceGroups(token, subscription, filters),
          getProviderAccounts(token, 'azure', filters)
        ])
          .then(([groupsData, accountsData]) => {
            setGroups(groupsData);
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
  }, [getToken, subscription]);

  const totalResources = groups.reduce((acc, curr) => acc + curr.resource_count, 0);

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
        <span className="font-medium text-gray-900">{accountName}</span>
      </div>

      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Resource Groups</h1>
          <p className="text-sm text-gray-500">Select a resource group to explore its resources.</p>
        </div>
        <div className="flex gap-4">
          <Card className="shadow-sm border-gray-200 min-w-[120px]">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center bg-gray-50/50">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Resource Groups</span>
              <span className="text-2xl font-bold text-gray-900">{groups.length}</span>
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

      <Card className="shadow-sm border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex-1">
            <InventoryFilters 
              onFiltersChange={setFilters} 
              showLocationFilter={false}
              showResourceTypeFilter={false}
            />
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 bg-azure-light/30 px-4 py-1 rounded-md border border-azure/20">
              <span className="text-sm font-medium text-azure-dark">
                Selected: {selectedIds.size} groups
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 text-gray-500 hover:text-gray-900">
                Clear
              </Button>
              {!assignUserId && (
                <Button 
                  size="sm" 
                  className="h-8 gap-2 bg-azure hover:bg-azure-dark text-white" 
                  onClick={() => navigate(`/bulk-tagging/wizard?provider=AZURE&scopeType=RESOURCE_GROUP&accountId=${encodeURIComponent(subscription || '')}&resourceGroup=${encodeURIComponent(Array.from(selectedIds).join(','))}${taskId ? `&task_id=${taskId}` : ''}`)}
                >
                  <Tags size={16} /> Bulk Tag
                </Button>
              )}
              {assignUserId && (
                <Button 
                  size="sm" 
                  className="h-8 gap-2 bg-azure hover:bg-azure-dark text-white" 
                  onClick={() => setAssignPayload({
                    provider: "AZURE",
                    scope_type: "RESOURCE_GROUP",
                    subscription_id: subscription || '',
                    resource_group: Array.from(selectedIds).join(','),
                    assigned_user_id: parseInt(assignUserId)
                  })}
                >
                  Assign Task
                </Button>
              )}
            </div>
          )}
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-azure focus:ring-azure"
                    checked={groups.length > 0 && selectedIds.size === groups.length}
                    ref={input => {
                      if (input) {
                        input.indeterminate = selectedIds.size > 0 && selectedIds.size < groups.length;
                      }
                    }}
                    onChange={handleSelectAll}
                    disabled={isLoading || groups.length === 0}
                  />
                </TableHead>
                <TableHead className="font-semibold text-gray-700">Resource Group Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Region(s)</TableHead>
                <TableHead className="font-semibold text-gray-700 text-center">Resource Types</TableHead>
                <TableHead className="font-semibold text-gray-700 text-center">Resources</TableHead>
                <TableHead className="w-48 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center text-gray-500">
                    Loading resource groups...
                  </TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400 space-y-3">
                      <Folder size={48} className="text-azure/40" />
                      <p className="text-sm font-medium text-gray-600">No resource groups available</p>
                      <p className="text-xs text-gray-400">Import resource inventory to see data here.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map(group => (
                  <TableRow key={group.name} className={`hover:bg-gray-50/50 ${selectedIds.has(group.name) ? 'bg-azure-light/20' : ''}`}>
                    <TableCell className="text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-azure focus:ring-azure"
                        checked={selectedIds.has(group.name)}
                        onChange={(e) => handleSelectResource(group.name, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">{group.name}</TableCell>
                    <TableCell className="text-gray-500 text-xs">{group.locations.join(', ') || 'N/A'}</TableCell>
                    <TableCell className="text-center">{group.types_count}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-azure-light text-azure">
                        {group.resource_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {user?.role === "ADMIN" && assignUserId && (
                        <Button variant="outline" size="sm" className="h-8 border-azure-200 text-azure hover:bg-azure-50" onClick={() => setAssignPayload({
                          provider: "AZURE",
                          scope_type: "RESOURCE_GROUP",
                          subscription_id: subscription || '',
                          resource_group: group.name,
                          assigned_user_id: parseInt(assignUserId)
                        })}>
                          Assign Task
                        </Button>
                      )}

                      <Button variant="ghost" size="sm" className="h-8 text-azure hover:bg-azure-light" asChild>
                        <Link to={`/azure/${encodeURIComponent(subscription || '')}/${encodeURIComponent(group.name)}${getQueryString()}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
