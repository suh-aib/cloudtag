import { Cloud, Search, Filter, ChevronRight, Server, Tags } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getAzureResources, getProviderAccounts, type ResourceDetail } from "../../services/api/inventory";
import { useNavigate } from "react-router-dom";

export default function AzureResourceList() {
  const { subscription, resourceGroup, resourceType } = useParams<{ subscription: string; resourceGroup: string; resourceType: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [resources, setResources] = useState<ResourceDetail[]>([]);
  const [accountName, setAccountName] = useState<string>(subscription || '');
  const [isLoading, setIsLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!subscription || !resourceGroup || !resourceType) return;
    setIsLoading(true);
    getToken().then(token => {
      if (token) {
        Promise.all([
          getAzureResources(token, subscription, resourceGroup, resourceType),
          getProviderAccounts(token, 'azure')
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
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to="/azure" className="hover:text-azure transition-colors flex items-center gap-1">
          <Cloud size={14} />
          Azure
        </Link>
        <ChevronRight size={14} />
        <Link to={`/azure/${encodeURIComponent(subscription || '')}`} className="hover:text-azure transition-colors truncate max-w-[150px]">
          {accountName}
        </Link>
        <ChevronRight size={14} />
        <Link to={`/azure/${encodeURIComponent(subscription || '')}/${encodeURIComponent(resourceGroup || '')}`} className="hover:text-azure transition-colors truncate max-w-[150px]">
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
        <Card className="shadow-sm border-gray-200 min-w-[120px]">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center bg-gray-50/50">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Resources</span>
            <span className="text-2xl font-bold text-gray-900">{resources.length}</span>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search resources..."
                className="pl-10 bg-gray-50/50"
              />
            </div>
            <Button variant="outline" className="gap-2 text-gray-600">
              <Filter size={16} /> Filter
            </Button>
          </div>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 bg-azure-light/30 px-4 py-1 rounded-md border border-azure/20">
              <span className="text-sm font-medium text-azure-dark">
                Selected: {selectedIds.size} resources
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 text-gray-500 hover:text-gray-900">
                Clear
              </Button>
              <Button size="sm" className="h-8 gap-2 bg-azure hover:bg-azure-dark" onClick={() => navigate(`/bulk-tagging/wizard?provider=AZURE&scopeType=RESOURCE_SELECTION&resourceIds=${Array.from(selectedIds).join(',')}`)}>
                <Tags size={16} /> Bulk Tag
              </Button>
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
                  <TableHead className="font-semibold text-gray-700 w-1/4">Resource Name</TableHead>
                  <TableHead className="font-semibold text-gray-700">Location</TableHead>
                  <TableHead className="font-semibold text-gray-700">Tagging Scope</TableHead>
                  <TableHead className="font-semibold text-gray-700">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center text-gray-500">
                      Loading resources...
                    </TableCell>
                  </TableRow>
                ) : resources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
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
                        <div className="text-xs text-gray-400 font-mono truncate max-w-sm mt-0.5" title={res.resource_id}>
                          {res.resource_id.split('/').pop()}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">{res.location || 'N/A'}</TableCell>
                      <TableCell>
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
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-azure hover:bg-azure-light"
                          onClick={() => {
                            navigate(`/bulk-tagging/wizard?provider=AZURE&scopeType=RESOURCE_SELECTION&resourceIds=${res.id}`);
                          }}
                        >
                          Tag
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
}
