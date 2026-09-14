import { Cloud, Search, Filter, ChevronRight, Layers, ArrowRight } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getAzureResourceTypes, getProviderAccounts, type ResourceTypeCount } from "../../services/api/inventory";

export default function AzureResourceTypes() {
  const { subscription, resourceGroup } = useParams<{ subscription: string; resourceGroup: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [types, setTypes] = useState<ResourceTypeCount[]>([]);
  const [accountName, setAccountName] = useState<string>(subscription || '');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!subscription || !resourceGroup) return;
    setIsLoading(true);
    getToken().then(token => {
      if (token) {
        Promise.all([
          getAzureResourceTypes(token, subscription, resourceGroup),
          getProviderAccounts(token, 'azure')
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
  }, [getToken, subscription, resourceGroup]);

  const totalResources = types.reduce((acc, curr) => acc + curr.resource_count, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to="/azure" className="hover:text-azure transition-colors flex items-center gap-1">
          <Cloud size={14} />
          Azure
        </Link>
        <ChevronRight size={14} />
        <Link to={`/azure/${encodeURIComponent(subscription || '')}`} className="hover:text-azure transition-colors truncate max-w-[200px]">
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

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search resource types..."
            className="pl-10 bg-white border-gray-200"
          />
        </div>
        <Button variant="outline" className="gap-2 text-gray-600 bg-white">
          <Filter size={16} /> Filter
        </Button>
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
            <Card key={type.resource_type} className="border-gray-200 hover:shadow-md transition-shadow group">
              <Link to={`/azure/${encodeURIComponent(subscription || '')}/${encodeURIComponent(resourceGroup || '')}/${encodeURIComponent(type.resource_type)}`}>
                <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">{type.display_name}</h3>
                    <p className="text-xs text-gray-500 font-mono truncate">{type.resource_type}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-azure-light text-azure">
                      {type.resource_count} resources
                    </span>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/bulk-tagging/wizard?provider=AZURE&scopeType=RESOURCE_TYPE&accountId=${encodeURIComponent(subscription || '')}&resourceGroup=${encodeURIComponent(resourceGroup || '')}&resourceType=${encodeURIComponent(type.resource_type)}`);
                        }}
                      >
                        Bulk Tag
                      </Button>
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
    </div>
  );
}
