import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { 
  getSharePointConfig, 
  updateSharePointConfig, 
  testSharePointConnection, 
  getSharePointMappings, 
  detectSharePointMappings,
  updateSharePointMapping,
  syncSharePoint 
} from "../../services/api/sharepoint";
import { AlertCircle, CheckCircle, Activity, Save, RefreshCw, FileSearch } from "lucide-react";

export default function SharePointConfiguration({ provider: activeTab }: { provider: "azure" | "aws" }) {
  const { getToken } = useAuth();
  
  const [config, setConfig] = useState<any>(null);
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // UI State
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    site_url: "",
    document_library: "",
    workbook: "",
    worksheet: "",
    status: "ACTIVE"
  });

  const fetchProviderData = async (provider: "azure" | "aws") => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const configData = await getSharePointConfig(token, provider);
      setConfig(configData);
      setFormData({
        site_url: configData.site_url || "",
        document_library: configData.document_library || "",
        workbook: configData.workbook || "",
        worksheet: configData.worksheet || "",
        status: configData.status || "ACTIVE"
      });

      const mappingData = await getSharePointMappings(token, provider);
      setMappings(mappingData);
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to load ${provider.toUpperCase()} SharePoint configuration.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderData(activeTab);
  }, [activeTab]);

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);
      
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const updated = await updateSharePointConfig(token, activeTab, formData);
      setConfig(updated);
      setSuccessMsg("Configuration saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setError(null);
      setSuccessMsg(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const res = await testSharePointConnection(token, activeTab);
      if (res.success) {
        setSuccessMsg(res.message);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Connection test failed.");
    }
  };

  const handleSync = async () => {
    try {
      setError(null);
      setSuccessMsg(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const res = await syncSharePoint(token, activeTab);
      setSuccessMsg(res.message || "Sync initiated.");
      fetchProviderData(activeTab); // Refresh status
    } catch (err: any) {
      setError(err.response?.data?.detail || "Sync failed to start.");
    }
  };

  const handleDetectHeaders = async () => {
    try {
      setError(null);
      setSuccessMsg(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const res = await detectSharePointMappings(token, activeTab);
      setMappings(res);
      setSuccessMsg("Headers detected and semantic mapping applied.");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to detect headers.");
    }
  };

  const handleUpdateMapping = async (mappingId: number, field: string, value: any) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const updated = await updateSharePointMapping(token, activeTab, mappingId, { [field]: value });
      setMappings(mappings.map(m => m.id === mappingId ? updated : m));
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update mapping.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {successMsg && (
        <div className="bg-green-50 text-green-700 p-4 rounded-md flex items-center gap-2 border border-green-200">
          <CheckCircle size={20} />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center gap-2 border border-red-200">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading configuration...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Configuration Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Connection Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SharePoint Site URL</label>
                  <input
                    type="text"
                    value={formData.site_url}
                    onChange={e => setFormData({ ...formData, site_url: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://malabar.sharepoint.com/sites/CloudTag"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document Library</label>
                  <input
                    type="text"
                    value={formData.document_library}
                    onChange={e => setFormData({ ...formData, document_library: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Shared Documents"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Workbook / File Name</label>
                    <input
                      type="text"
                      value={formData.workbook}
                      onChange={e => setFormData({ ...formData, workbook: e.target.value })}
                      className="w-full border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Inventory.xlsx"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Worksheet / Table</label>
                    <input
                      type="text"
                      value={formData.worksheet}
                      onChange={e => setFormData({ ...formData, worksheet: e.target.value })}
                      className="w-full border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Resources"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
                >
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Config"}
                </button>
              </div>
            </div>

            {/* Mappings */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="text-lg font-semibold">Semantic Mappings</h2>
                <button 
                  onClick={handleDetectHeaders}
                  className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1"
                >
                  <FileSearch size={16} /> Detect Headers
                </button>
              </div>
              
              {mappings.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">
                  No intelligent mappings detected yet. Configure source file and detect headers.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-600">
                      <th className="p-3 font-medium">Source Header</th>
                      <th className="p-3 font-medium">Detected Meaning</th>
                      <th className="p-3 font-medium">Confidence</th>
                      <th className="p-3 font-medium">Sample Values</th>
                      <th className="p-3 font-medium">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map(m => (
                      <tr key={m.id} className={`border-b ${m.is_ignored ? "bg-gray-50 opacity-60" : ""}`}>
                        <td className="p-3 font-mono font-medium">{m.source_header}</td>
                        <td className="p-3">
                          <select 
                            value={m.target_field || ""}
                            onChange={(e) => handleUpdateMapping(m.id, "target_field", e.target.value)}
                            disabled={m.is_approved || m.is_ignored}
                            className="border rounded px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                          >
                            <option value="">-- Unmapped --</option>
                            <option value="account_name">Account / Subscription</option>
                            <option value="resource_group">Resource Group / VPC</option>
                            <option value="resource_name">Resource Name</option>
                            <option value="resource_type">Resource Type / Service</option>
                            <option value="region">Region / Location</option>
                            <option value="resource_id">Resource ID / ARN</option>
                            <option value="owner">Owner / Contact</option>
                            <option value="environment">Environment</option>
                          </select>
                        </td>
                        <td className="p-3">
                          {m.confidence_score !== null ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              m.confidence_score >= 80 ? "bg-green-100 text-green-800" :
                              m.confidence_score >= 50 ? "bg-yellow-100 text-yellow-800" :
                              "bg-red-100 text-red-800"
                            }`}>
                              {m.confidence_score}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="text-xs text-gray-500 font-mono truncate max-w-[150px]" title={m.sample_values}>
                            {m.sample_values ? (() => {
                              try {
                                const arr = JSON.parse(m.sample_values);
                                return arr.join(", ");
                              } catch { return m.sample_values; }
                            })() : "No data"}
                          </div>
                        </td>
                        <td className="p-3">
                          {m.is_ignored ? (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-medium">Ignored</span>
                              <button onClick={() => handleUpdateMapping(m.id, "is_ignored", false)} className="text-xs text-blue-600 hover:underline">Restore</button>
                            </div>
                          ) : m.is_approved ? (
                            <div className="flex items-center gap-2">
                              <span className="text-green-600 font-medium">Approved</span>
                              <button onClick={() => handleUpdateMapping(m.id, "is_approved", false)} className="text-xs text-blue-600 hover:underline">Edit</button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <button onClick={() => handleUpdateMapping(m.id, "is_approved", true)} className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded text-xs hover:bg-blue-100">Accept</button>
                              <button onClick={() => handleUpdateMapping(m.id, "is_ignored", true)} className="text-gray-500 hover:text-gray-700 text-xs text-left px-1">Ignore</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Sidebar - Status & Actions */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Actions</h2>
              <div className="space-y-3">
                <button 
                  onClick={handleTestConnection}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-purple-200 bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 transition-colors font-medium text-sm"
                >
                  <Activity size={16} /> Test Connection
                </button>
                <button 
                  onClick={handleSync}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors font-medium text-sm"
                >
                  <RefreshCw size={16} /> Run Sync
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Status Dashboard</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">Last Sync Job</div>
                  <div className="font-medium text-gray-900">
                    {config?.latest_sync?.start_time 
                      ? new Date(config.latest_sync.start_time).toLocaleString() 
                      : "Never"}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Sync Status</div>
                  <div>
                    {config?.latest_sync?.status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        config.latest_sync.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                        config.latest_sync.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {config.latest_sync.status}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">No runs yet</span>
                    )}
                  </div>
                </div>
                {config?.latest_sync?.error_message && (
                  <div>
                    <div className="text-red-500 font-medium mb-1">Last Error</div>
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 overflow-hidden break-words">
                      {config.latest_sync.error_message}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-gray-500 mb-1">Records Processed</div>
                  <div className="font-medium font-mono text-gray-900">
                    {config?.latest_sync?.records_processed || 0}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
