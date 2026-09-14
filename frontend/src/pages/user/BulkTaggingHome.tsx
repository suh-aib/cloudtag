import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Cloud, Server, ArrowRight, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { getProviderAccounts, getAzureResourceGroups, getAzureResourceTypes } from "../../services/api/inventory";
import type { InventoryAccount, ResourceGroupCount, ResourceTypeCount } from "../../services/api/inventory";

export default function BulkTaggingHome() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [provider, setProvider] = useState<'AZURE' | 'AWS' | null>(null);
  const [scopeType, setScopeType] = useState<string>("");
  
  // Data
  const [accounts, setAccounts] = useState<InventoryAccount[]>([]);
  const [resourceGroups, setResourceGroups] = useState<ResourceGroupCount[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceTypeCount[]>([]);
  
  // Selection
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedResourceGroup, setSelectedResourceGroup] = useState("");
  const [selectedResourceType, setSelectedResourceType] = useState("");

  useEffect(() => {
    if (provider) {
      setAccounts([]);
      setSelectedAccountId("");
      getToken().then(token => {
        if (token) {
          getProviderAccounts(token, provider.toLowerCase() as any).then(setAccounts).catch(console.error);
        }
      });
    }
  }, [provider, getToken]);

  useEffect(() => {
    if (selectedAccountId && (scopeType === 'RESOURCE_GROUP' || scopeType === 'RESOURCE_TYPE')) {
      setResourceGroups([]);
      setSelectedResourceGroup("");
      getToken().then(token => {
        if (token) {
          getAzureResourceGroups(token, selectedAccountId).then(setResourceGroups).catch(console.error);
        }
      });
    }
  }, [selectedAccountId, scopeType, getToken]);

  useEffect(() => {
    if (selectedAccountId && selectedResourceGroup && scopeType === 'RESOURCE_TYPE') {
      setResourceTypes([]);
      setSelectedResourceType("");
      getToken().then(token => {
        if (token) {
          getAzureResourceTypes(token, selectedAccountId, selectedResourceGroup).then(setResourceTypes).catch(console.error);
        }
      });
    }
  }, [selectedAccountId, selectedResourceGroup, scopeType, getToken]);

  const canContinue = () => {
    if (!provider || !scopeType) return false;
    if (provider === 'AZURE') {
      if (scopeType === 'SUBSCRIPTION' && !selectedAccountId) return false;
      if (scopeType === 'RESOURCE_GROUP' && (!selectedAccountId || !selectedResourceGroup)) return false;
      if (scopeType === 'RESOURCE_TYPE' && (!selectedAccountId || !selectedResourceGroup || !selectedResourceType)) return false;
    } else {
      if (scopeType === 'AWS_ACCOUNT' && !selectedAccountId) return false;
      // AWS advanced scopes can be added here
    }
    return true;
  };

  const handleContinue = () => {
    if (!canContinue()) return;
    const params = new URLSearchParams();
    if (provider) params.set('provider', provider);
    if (scopeType) params.set('scopeType', scopeType);
    if (selectedAccountId) params.set('accountId', selectedAccountId);
    if (selectedResourceGroup) params.set('resourceGroup', selectedResourceGroup);
    if (selectedResourceType) params.set('resourceType', selectedResourceType);
    
    navigate(`/bulk-tagging/wizard?${params.toString()}`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Tag className="text-purple-500" /> Bulk Tagging
        </h1>
        <p className="text-sm text-gray-500">
          Select a scope to analyze and apply tags across hundreds or thousands of resources at once.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Select Cloud</CardTitle>
            <CardDescription>Which cloud provider do you want to tag?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <button 
              className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${provider === 'AZURE' ? 'border-azure bg-azure/5' : 'border-gray-200 hover:border-azure/50'}`}
              onClick={() => { setProvider('AZURE'); setScopeType(""); }}
            >
              <Cloud className={provider === 'AZURE' ? 'text-azure' : 'text-gray-400'} size={24} />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Microsoft Azure</div>
                <div className="text-xs text-gray-500">Tag Subscriptions, Resource Groups, or Types</div>
              </div>
            </button>
            <button 
              className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${provider === 'AWS' ? 'border-aws bg-aws/5' : 'border-gray-200 hover:border-aws/50'}`}
              onClick={() => { setProvider('AWS'); setScopeType(""); }}
            >
              <Server className={provider === 'AWS' ? 'text-aws' : 'text-gray-400'} size={24} />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Amazon Web Services</div>
                <div className="text-xs text-gray-500">Tag Accounts or Resource Types</div>
              </div>
            </button>
          </CardContent>
        </Card>

        {provider && (
          <Card className="animate-in fade-in slide-in-from-right-4 duration-300">
            <CardHeader>
              <CardTitle className="text-lg">2. Select Scope</CardTitle>
              <CardDescription>At what level do you want to apply tags?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Scope Type</label>
                <select 
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm p-2 border bg-white"
                  value={scopeType}
                  onChange={(e) => {
                    setScopeType(e.target.value);
                    setSelectedAccountId("");
                    setSelectedResourceGroup("");
                    setSelectedResourceType("");
                  }}
                >
                  <option value="">-- Select Scope --</option>
                  {provider === 'AZURE' ? (
                    <>
                      <option value="SUBSCRIPTION">Entire Subscription</option>
                      <option value="RESOURCE_GROUP">Resource Group</option>
                      <option value="RESOURCE_TYPE">Specific Resource Type</option>
                    </>
                  ) : (
                    <>
                      <option value="AWS_ACCOUNT">Entire AWS Account</option>
                      {/* Can add AWS RESOURCE_TYPE later */}
                    </>
                  )}
                </select>
              </div>

              {scopeType && accounts.length > 0 && (
                <div className="space-y-1 animate-in fade-in duration-300">
                  <label className="text-sm font-medium text-gray-700">
                    {provider === 'AZURE' ? 'Subscription' : 'Account'}
                  </label>
                  <select 
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm p-2 border bg-white"
                    value={selectedAccountId}
                    onChange={(e) => {
                      setSelectedAccountId(e.target.value);
                      setSelectedResourceGroup("");
                      setSelectedResourceType("");
                    }}
                  >
                    <option value="">-- Select --</option>
                    {accounts.map(a => (
                      <option key={a.account_identifier} value={a.account_identifier}>
                        {a.account_name} ({a.account_identifier})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedAccountId && (scopeType === 'RESOURCE_GROUP' || scopeType === 'RESOURCE_TYPE') && (
                <div className="space-y-1 animate-in fade-in duration-300">
                  <label className="text-sm font-medium text-gray-700">Resource Group</label>
                  <select 
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm p-2 border bg-white"
                    value={selectedResourceGroup}
                    onChange={(e) => {
                      setSelectedResourceGroup(e.target.value);
                      setSelectedResourceType("");
                    }}
                  >
                    <option value="">-- Select --</option>
                    {resourceGroups.map(rg => (
                      <option key={rg.name} value={rg.name}>
                        {rg.name} ({rg.resource_count} resources)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedResourceGroup && scopeType === 'RESOURCE_TYPE' && (
                <div className="space-y-1 animate-in fade-in duration-300">
                  <label className="text-sm font-medium text-gray-700">Resource Type</label>
                  <select 
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm p-2 border bg-white"
                    value={selectedResourceType}
                    onChange={(e) => setSelectedResourceType(e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {resourceTypes.map(rt => (
                      <option key={rt.resource_type} value={rt.resource_type}>
                        {rt.display_name} ({rt.resource_count} resources)
                      </option>
                    ))}
                  </select>
                </div>
              )}

            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          size="lg"
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2 font-medium" 
          disabled={!canContinue()}
          onClick={handleContinue}
        >
          Continue to Tagging <ArrowRight size={18} />
        </Button>
      </div>
    </div>
  );
}
