import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { 
  getCloudAccounts, 
  createCloudAccount, 
  updateCloudAccount, 
  syncCloudRegions, 
  testCloudConnection 
} from "../../services/api/cloud";
import { Plus, Edit2, Globe, Activity, CheckCircle, AlertCircle, Search } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/Tabs";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { Cloud, Server, X } from "lucide-react";

export default function CloudConfiguration() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"AZURE" | "AWS">("AZURE");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  
  // Forms state
  const [formData, setFormData] = useState({ name: "", account_identifier: "" });
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [regionInput, setRegionInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const data = await getCloudAccounts(token, activeTab);
      setAccounts(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load cloud accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    setSearch("");
    setStatusFilter("");
  }, [activeTab]);

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.name.toLowerCase().includes(search.toLowerCase()) || 
                          acc.account_identifier.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? acc.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const handleTestConnection = async (id: number) => {
    try {
      setActionError(null);
      setActionSuccess(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await testCloudConnection(token, id);
      setActionSuccess(res.message);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to test connection");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleToggleStatus = async (account: any) => {
    try {
      setActionError(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const newStatus = account.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
      const updated = await updateCloudAccount(token, account.id, { status: newStatus });
      setAccounts(accounts.map(a => a.id === updated.id ? updated : a));
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to update status");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const openAddModal = () => {
    setSelectedAccount(null);
    setFormData({ name: "", account_identifier: "" });
    setActionError(null);
    setIsEditModalOpen(true);
  };

  const openEditModal = (account: any) => {
    setSelectedAccount(account);
    setFormData({ name: account.name, account_identifier: account.account_identifier });
    setActionError(null);
    setIsEditModalOpen(true);
  };

  const saveAccount = async () => {
    try {
      setActionError(null);
      if (!formData.name || !formData.account_identifier) {
        setActionError("Both fields are required.");
        return;
      }
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      if (selectedAccount) {
        const updated = await updateCloudAccount(token, selectedAccount.id, formData);
        setAccounts(accounts.map(a => a.id === updated.id ? updated : a));
      } else {
        const created = await createCloudAccount(token, {
          ...formData,
          cloud: activeTab
        });
        setAccounts([created, ...accounts]);
      }
      setIsEditModalOpen(false);
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to save account");
    }
  };

  const openRegionModal = (account: any) => {
    setSelectedAccount(account);
    const enabled = account.regions.filter((r: any) => r.enabled).map((r: any) => r.name);
    setSelectedRegions(enabled);
    setRegionInput("");
    setActionError(null);
    setIsRegionModalOpen(true);
  };

  const saveRegions = async () => {
    try {
      setActionError(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const updated = await syncCloudRegions(token, selectedAccount.id, selectedRegions);
      setAccounts(accounts.map(a => a.id === updated.id ? updated : a));
      setIsRegionModalOpen(false);
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to sync regions");
    }
  };

  const addRegion = () => {
    if (regionInput.trim() && !selectedRegions.includes(regionInput.trim())) {
      setSelectedRegions([...selectedRegions, regionInput.trim()]);
    }
    setRegionInput("");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cloud Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your cloud provider connections and subscriptions.</p>
        </div>
        <Button onClick={openAddModal} className="gap-2">
          <Plus size={16} />
          Add {activeTab === "AZURE" ? "Subscription" : "Account"}
        </Button>
      </div>

      <Tabs>
        <TabsList>
          <TabsTrigger value="AZURE" activeValue={activeTab} onValueChange={(v) => setActiveTab(v as "AZURE")}>Azure Subscriptions</TabsTrigger>
          <TabsTrigger value="AWS" activeValue={activeTab} onValueChange={(v) => setActiveTab(v as "AWS")}>AWS Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} activeValue={activeTab}>
          {actionSuccess && (
            <div className="bg-green-50 text-green-700 p-4 rounded-md mb-6 flex items-center gap-2 border border-green-200 shadow-sm">
              <CheckCircle size={18} />
              <span className="text-sm font-medium">{actionSuccess}</span>
            </div>
          )}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6 flex items-center gap-2 border border-red-200 shadow-sm">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row justify-between items-center space-y-0">
              <div className="flex items-center gap-4 w-full">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name or ID..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12"><Spinner className="h-8 w-8 text-gray-400" /></div>
              ) : filteredAccounts.length === 0 ? (
                <EmptyState 
                  icon={activeTab === "AZURE" ? <Cloud size={48} /> : <Server size={48} />}
                  title={activeTab === "AZURE" ? "No Azure subscriptions configured" : "No AWS accounts configured"}
                  description={`Add an ${activeTab === "AZURE" ? "Azure subscription" : "AWS account"} to begin configuring CloudTag.`}
                  action={
                    <Button onClick={openAddModal}>
                      <Plus size={16} className="mr-2" />
                      Add {activeTab === "AZURE" ? "Subscription" : "Account"}
                    </Button>
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Regions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-medium text-gray-900">{acc.name}</TableCell>
                        <TableCell className="font-mono text-xs text-gray-500">{acc.account_identifier}</TableCell>
                        <TableCell>
                          <button 
                            onClick={() => openRegionModal(acc)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-100"
                          >
                            <Globe size={12} />
                            {acc.regions.filter((r:any) => r.enabled).length} Enabled
                          </button>
                        </TableCell>
                        <TableCell>
                           <button onClick={() => handleToggleStatus(acc)}>
                            <Badge variant={acc.status === 'ACTIVE' ? "success" : "secondary"}>
                              {acc.status}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => openEditModal(acc)}><Edit2 size={16} /></Button>
                            <Button variant="ghost" size="icon" title="Test Connection" onClick={() => handleTestConnection(acc.id)}><Activity size={16} /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogHeader onClose={() => setIsEditModalOpen(false)}>
          <DialogTitle>{selectedAccount ? "Edit" : "Add"} {activeTab === "AZURE" ? "Subscription" : "Account"}</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          {actionError && (
            <div className="p-3 bg-red-50 text-red-700 rounded text-sm border border-red-200">
              {actionError}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Name</label>
            <Input 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              placeholder="e.g. Production Environment" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{activeTab === "AZURE" ? "Subscription ID" : "AWS Account ID"}</label>
            <Input 
              value={formData.account_identifier} 
              onChange={e => setFormData({ ...formData, account_identifier: e.target.value })} 
              placeholder={activeTab === "AZURE" ? "00000000-0000-0000-0000-000000000000" : "123456789012"} 
              className="font-mono text-sm"
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
          <Button onClick={saveAccount}>Save Configuration</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={isRegionModalOpen} onOpenChange={setIsRegionModalOpen}>
        <DialogHeader onClose={() => setIsRegionModalOpen(false)}>
          <DialogTitle>Manage Enabled Regions</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-6 max-w-6xl mx-auto py-2">
          {actionError && (
            <div className="p-3 bg-red-50 text-red-700 rounded text-sm border border-red-200">
              {actionError}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add Region Code</label>
            <div className="flex gap-2">
              <Input 
                value={regionInput} 
                onChange={e => setRegionInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addRegion()}
                placeholder={activeTab === "AZURE" ? "EASTUS" : "US-EAST-1"}
                className="font-mono uppercase text-sm"
              />
              <Button variant="secondary" onClick={addRegion}>Add</Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Currently Enabled Regions</div>
            {selectedRegions.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No regions enabled. Discovery will skip this account.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedRegions.map(region => (
                  <Badge key={region} variant="outline" className="font-mono uppercase bg-blue-50 text-blue-700 border-blue-200 gap-1 pl-2 pr-1 py-1">
                    {region}
                    <button onClick={() => setSelectedRegions(selectedRegions.filter(r => r !== region))} className="hover:text-red-500 hover:bg-blue-100 rounded-full p-0.5 ml-1 transition-colors">
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsRegionModalOpen(false)}>Cancel</Button>
          <Button onClick={saveRegions}>Save Regions</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
