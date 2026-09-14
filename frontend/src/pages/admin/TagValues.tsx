import { useState, useEffect } from "react";
import { ListFilter, Tag, Plus, Edit2, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Badge } from "../../components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { useAuth } from "../../contexts/AuthContext";
import type { TagDefinition, TagValue } from "../../services/api/tagging";
import { getAdminTagDefinitions, createAdminTagValue, updateAdminTagValue, deleteAdminTagValue } from "../../services/api/adminTags";

export default function TagValues() {
  const { getToken } = useAuth();
  const [activeProvider, setActiveProvider] = useState<"AZURE" | "AWS">("AZURE");
  const [definitions, setDefinitions] = useState<TagDefinition[]>([]);
  const [selectedDef, setSelectedDef] = useState<TagDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<TagValue | null>(null);
  
  // Form state
  const [value, setValue] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [enabled, setEnabled] = useState(true);

  const fetchDefinitions = async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAdminTagDefinitions(token, activeProvider);
      setDefinitions(data);
      // Re-select if previously selected
      if (selectedDef) {
        const refreshed = data.find(d => d.id === selectedDef.id);
        setSelectedDef(refreshed || null);
      }
    } catch (err) {
      console.error("Failed to fetch definitions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefinitions();
  }, [activeProvider]);

  const handleOpenAdd = () => {
    setEditingValue(null);
    setValue("");
    setDisplayName("");
    setEnabled(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (val: TagValue) => {
    setEditingValue(val);
    setValue(val.value);
    setDisplayName(val.display_name || "");
    setEnabled(val.enabled);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const token = await getToken();
    if (!token || !value || !selectedDef) return;
    try {
      if (editingValue) {
        await updateAdminTagValue(token, editingValue.id, {
          display_name: displayName,
          enabled
        });
      } else {
        await createAdminTagValue(token, selectedDef.id, {
          value,
          display_name: displayName,
          enabled
        });
      }
      setIsModalOpen(false);
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to save value", err);
      alert("Failed to save value. Does this value already exist?");
    }
  };

  const handleDelete = async (id: number) => {
    const token = await getToken();
    if (!token || !confirm("Are you sure you want to delete this value?")) return;
    try {
      await deleteAdminTagValue(token, id);
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to delete value", err);
    }
  };

  const toggleEnabled = async (val: TagValue) => {
    const token = await getToken();
    if (!token) return;
    try {
      await updateAdminTagValue(token, val.id, { enabled: !val.enabled });
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to toggle value", err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tag Values</h1>
          <p className="text-sm text-gray-500 mt-1">Manage allowed values for pre-defined tag lists.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="col-span-1 border-r pr-6 min-h-[500px]">
          <div className="flex items-center gap-2 mb-6">
            <button 
              onClick={() => { setActiveProvider("AZURE"); setSelectedDef(null); }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${activeProvider === "AZURE" ? "bg-azure/10 text-azure" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Azure
            </button>
            <button 
              onClick={() => { setActiveProvider("AWS"); setSelectedDef(null); }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${activeProvider === "AWS" ? "bg-aws/10 text-aws" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              AWS
            </button>
          </div>
          
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ListFilter size={18} /> Select Tag
          </h3>
          <div className="space-y-1">
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : definitions.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No {activeProvider} tags configured.</p>
            ) : (
              definitions.map(def => (
                <button
                  key={def.id}
                  onClick={() => setSelectedDef(def)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedDef?.id === def.id ? (activeProvider === "AZURE" ? "bg-azure text-white" : "bg-aws text-white") : "hover:bg-gray-100"}`}
                >
                  <div className="font-medium font-mono">{def.name}</div>
                  <div className={`text-xs ${selectedDef?.id === def.id ? "text-white/80" : "text-gray-500"}`}>
                    {def.values ? def.values.length : 0} values
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        
        <div className="col-span-1 md:col-span-3">
          {selectedDef ? (
            <Card className="h-full border border-gray-200 shadow-sm bg-white">
              <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="font-mono text-xl">{selectedDef.name}</CardTitle>
                  <CardDescription className="mt-1">{selectedDef.description || "Manage the dictionary of acceptable values for this tag."}</CardDescription>
                </div>
                <Button className={`${activeProvider === "AZURE" ? "bg-azure hover:bg-azure/90" : "bg-aws hover:bg-aws/90"} text-white gap-2`} onClick={handleOpenAdd}>
                  <Plus size={16} /> Add Value
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {selectedDef.values && selectedDef.values.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow>
                        <TableHead className="font-semibold text-gray-700 pl-6">Value</TableHead>
                        <TableHead className="font-semibold text-gray-700">Display Name</TableHead>
                        <TableHead className="font-semibold text-gray-700 text-center">Status</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700 pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDef.values.map(val => (
                        <TableRow key={val.id}>
                          <TableCell className="pl-6 font-medium text-gray-900">{val.value}</TableCell>
                          <TableCell className="text-gray-500">{val.display_name || "-"}</TableCell>
                          <TableCell className="text-center">
                            <button onClick={() => toggleEnabled(val)} className="focus:outline-none">
                              <Badge variant={val.enabled ? "success" : "secondary"} className="cursor-pointer">
                                {val.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </button>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 gap-1.5 h-8" onClick={() => handleOpenEdit(val)}>
                              <Edit2 size={14} /> Edit
                            </Button>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500 h-8 w-8 ml-1" onClick={() => handleDelete(val.id)}>
                              <Trash2 size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState 
                    icon={<Tag size={48} className="text-gray-200" />}
                    title="No values defined"
                    description={`Add allowed values for the ${selectedDef.name} tag.`}
                    className="py-16 bg-transparent border-0"
                    action={
                      <Button variant="outline" className={`mt-2 ${activeProvider === "AZURE" ? "text-azure border-azure/30" : "text-aws border-aws/30"}`} onClick={handleOpenAdd}>
                        <Plus size={16} className="mr-2" /> Add First Value
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full border-none shadow-none bg-transparent">
              <CardHeader className="px-0 pt-0">
                <CardTitle>Allowed Values</CardTitle>
                <CardDescription>Configure the dictionary of acceptable values for this tag.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <EmptyState 
                  icon={<Tag size={48} className="text-gray-300" />}
                  title="Select a Tag"
                  description="Select a tag from the sidebar to manage its allowed values."
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && selectedDef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-lg">{editingValue ? "Edit Tag Value" : "Add Tag Value"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Value <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={value} 
                  onChange={(e) => setValue(e.target.value)}
                  disabled={!!editingValue}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-azure focus:border-azure disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="e.g. PROD"
                />
                {!editingValue && <p className="text-xs text-gray-500">The actual value written to the cloud resource.</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Display Name (Optional)</label>
                <input 
                  type="text"
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-azure focus:border-azure"
                  placeholder="e.g. Production Environment"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="enabled" 
                  checked={enabled} 
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 text-azure border-gray-300 rounded focus:ring-azure"
                />
                <label htmlFor="enabled" className="text-sm text-gray-700">Enabled</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 bg-gray-50 border-t">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button className={activeProvider === "AZURE" ? "bg-azure hover:bg-azure/90 text-white" : "bg-aws hover:bg-aws/90 text-white"} onClick={handleSave} disabled={!value}>
                {editingValue ? "Save Changes" : "Create Value"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
