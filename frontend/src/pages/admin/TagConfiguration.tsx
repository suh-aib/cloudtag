import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Tag, ShieldAlert, X, ChevronDown, ChevronRight, ListPlus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuth } from "../../contexts/AuthContext";
import { 
  getAdminTagDefinitions, 
  createAdminTagDefinition, 
  updateAdminTagDefinition, 
  deleteAdminTagDefinition,
  createAdminTagValue,
  createAdminTagValuesBulk,
  updateAdminTagValue,
  deleteAdminTagValue
} from "../../services/api/adminTags";
import type { TagDefinition, TagValue } from "../../services/api/tagging";

export default function TagConfiguration() {
  const { getToken } = useAuth();
  const [activeProvider, setActiveProvider] = useState<"AZURE" | "AWS" | "SHARED">("AZURE");
  const [definitions, setDefinitions] = useState<TagDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDefs, setExpandedDefs] = useState<Record<number, boolean>>({});
  
  // Def Modal state
  const [isDefModalOpen, setIsDefModalOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<TagDefinition | null>(null);
  
  // Def Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [appliesToAzure, setAppliesToAzure] = useState(true);
  const [appliesToAws, setAppliesToAws] = useState(false);

  // Value Modal state
  const [isValueModalOpen, setIsValueModalOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<TagValue | null>(null);
  const [valueParentDef, setValueParentDef] = useState<TagDefinition | null>(null);
  
  // Value Form state
  const [val, setVal] = useState("");
  const [valDisplayName, setValDisplayName] = useState("");
  const [valEnabled, setValEnabled] = useState(true);

  // Bulk Add Modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkParentDef, setBulkParentDef] = useState<TagDefinition | null>(null);

  const fetchDefinitions = async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAdminTagDefinitions(token, activeProvider);
      setDefinitions(data);
    } catch (err) {
      console.error("Failed to fetch definitions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefinitions();
  }, [activeProvider]);

  const toggleExpand = (id: number) => {
    setExpandedDefs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenAddDef = () => {
    setEditingDef(null);
    setName("");
    setDescription("");
    setMandatory(false);
    setEnabled(true);
    setAppliesToAzure(activeProvider === "AZURE");
    setAppliesToAws(activeProvider === "AWS");
    setIsDefModalOpen(true);
  };

  const handleOpenEditDef = (def: TagDefinition) => {
    setEditingDef(def);
    setName(def.name);
    setDescription(def.description || "");
    setMandatory(def.mandatory);
    setEnabled(def.enabled);
    setAppliesToAzure(def.provider === "AZURE" || def.provider === "SHARED");
    setAppliesToAws(def.provider === "AWS" || def.provider === "SHARED");
    setIsDefModalOpen(true);
  };

  const handleSaveDef = async () => {
    const token = await getToken();
    if (!token || !name) return;
    if (!appliesToAzure && !appliesToAws) {
      alert("Tag must apply to at least one cloud provider.");
      return;
    }
    
    let newProvider = "AZURE";
    if (appliesToAzure && appliesToAws) newProvider = "SHARED";
    else if (appliesToAws) newProvider = "AWS";

    try {
      if (editingDef) {
        await updateAdminTagDefinition(token, editingDef.id, {
          provider: newProvider,
          description,
          mandatory,
          enabled
        });
      } else {
        await createAdminTagDefinition(token, {
          provider: newProvider,
          name,
          description,
          mandatory,
          enabled
        });
      }
      setIsDefModalOpen(false);
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to save definition", err);
      alert("Failed to save tag definition. Does a tag with this name already exist?");
    }
  };

  const handleDeleteDef = async (id: number) => {
    const token = await getToken();
    if (!token || !confirm("Are you sure you want to delete this tag and all its allowed values?")) return;
    try {
      await deleteAdminTagDefinition(token, id);
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to delete definition", err);
    }
  };

  const toggleDefEnabled = async (def: TagDefinition) => {
    const token = await getToken();
    if (!token) return;
    try {
      await updateAdminTagDefinition(token, def.id, { enabled: !def.enabled });
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to toggle definition", err);
    }
  };

  const handleOpenAddValue = (def: TagDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    setValueParentDef(def);
    setEditingValue(null);
    setVal("");
    setValDisplayName("");
    setValEnabled(true);
    setIsValueModalOpen(true);
  };

  const handleOpenEditValue = (def: TagDefinition, valueObj: TagValue, e: React.MouseEvent) => {
    e.stopPropagation();
    setValueParentDef(def);
    setEditingValue(valueObj);
    setVal(valueObj.value);
    setValDisplayName(valueObj.display_name || "");
    setValEnabled(valueObj.enabled);
    setIsValueModalOpen(true);
  };

  const handleSaveValue = async () => {
    const token = await getToken();
    if (!token || !val || !valueParentDef) return;
    try {
      if (editingValue) {
        await updateAdminTagValue(token, editingValue.id, {
          display_name: valDisplayName,
          enabled: valEnabled
        });
      } else {
        await createAdminTagValue(token, valueParentDef.id, {
          value: val,
          display_name: valDisplayName,
          enabled: valEnabled
        });
      }
      setIsValueModalOpen(false);
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to save value", err);
      alert("Failed to save value. Does it already exist?");
    }
  };

  const handleDeleteValue = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = await getToken();
    if (!token || !confirm("Are you sure you want to delete this value?")) return;
    try {
      await deleteAdminTagValue(token, id);
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to delete value", err);
    }
  };

  const toggleValueEnabled = async (valueObj: TagValue, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = await getToken();
    if (!token) return;
    try {
      await updateAdminTagValue(token, valueObj.id, { enabled: !valueObj.enabled });
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to toggle value", err);
    }
  };

  const handleOpenBulkAdd = (def: TagDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    setBulkParentDef(def);
    setBulkInput("");
    setIsBulkModalOpen(true);
  };

  const handleSaveBulk = async () => {
    const token = await getToken();
    if (!token || !bulkParentDef || !bulkInput.trim()) return;
    const lines = bulkInput.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    
    try {
      await createAdminTagValuesBulk(token, bulkParentDef.id, lines);
      setIsBulkModalOpen(false);
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to bulk add values", err);
      alert("Failed to bulk add values.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tag Configuration</h1>
          <p className="text-sm text-gray-500">Manage tag definitions and their dictionaries of allowed values.</p>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardHeader className="border-b border-gray-100 pb-4 flex flex-row items-center justify-between">
          <div className="flex gap-6">
            <button 
              onClick={() => setActiveProvider("AZURE")}
              className={`text-sm font-semibold pb-4 -mb-4 ${activeProvider === "AZURE" ? "text-azure border-b-2 border-azure" : "text-gray-500 hover:text-gray-700"}`}
            >
              Azure Tags
            </button>
            <button 
              onClick={() => setActiveProvider("AWS")}
              className={`text-sm font-semibold pb-4 -mb-4 ${activeProvider === "AWS" ? "text-aws border-b-2 border-aws" : "text-gray-500 hover:text-gray-700"}`}
            >
              AWS Tags
            </button>
          </div>
          <Button 
            className={`${activeProvider === "AZURE" ? "bg-azure hover:bg-azure/90" : "bg-aws hover:bg-aws/90"} text-white gap-2`}
            onClick={handleOpenAddDef}
          >
            <Plus size={16} /> Add Tag Definition
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : definitions.length > 0 ? (
            <div className="divide-y divide-gray-100">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="font-semibold text-gray-700">Tag Key</TableHead>
                    <TableHead className="font-semibold text-gray-700">Requirement</TableHead>
                    <TableHead className="font-semibold text-gray-700">Values</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center">Status</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {definitions.map((def) => {
                    const isExpanded = expandedDefs[def.id];
                    return (
                      <React.Fragment key={def.id}>
                        <TableRow className="bg-white hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => toggleExpand(def.id)}>
                          <TableCell className="p-2 w-8">
                            {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-sm font-medium flex items-center gap-2 text-gray-900">
                              {def.name}
                              {def.provider === "SHARED" && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">SHARED</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{def.description}</div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {def.mandatory ? (
                              <div className="flex items-center text-red-600 gap-1"><ShieldAlert size={14} /> Required</div>
                            ) : (
                              <div className="text-gray-500">Optional</div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-gray-600">
                            {def.values ? def.values.length : 0} values
                          </TableCell>
                          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                            <button onClick={() => toggleDefEnabled(def)} className="focus:outline-none">
                              <Badge variant={def.enabled ? "success" : "secondary"} className="cursor-pointer hover:opacity-80">
                                {def.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </button>
                          </TableCell>
                          <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 gap-1.5 h-8" onClick={() => handleOpenEditDef(def)}>
                              <Edit2 size={14} /> Edit
                            </Button>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500 h-8 w-8 ml-1" onClick={() => handleDeleteDef(def.id)}>
                              <Trash2 size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                        
                        {isExpanded && (
                          <TableRow className="bg-gray-50/50">
                            <TableCell colSpan={6} className="p-0 border-b-2 border-gray-100">
                              <div className="pl-14 pr-6 py-4">
                                <div className="flex justify-between items-center mb-3">
                                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Allowed Values</h4>
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={(e) => handleOpenBulkAdd(def, e)}>
                                      <ListPlus size={12} /> Bulk Add
                                    </Button>
                                    <Button size="sm" className="h-7 text-xs bg-gray-900 hover:bg-gray-800 text-white gap-1.5" onClick={(e) => handleOpenAddValue(def, e)}>
                                      <Plus size={12} /> Add Value
                                    </Button>
                                  </div>
                                </div>
                                
                                {def.values && def.values.length > 0 ? (
                                  <div className="bg-white border rounded-md overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Value</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Display Name</th>
                                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-100">
                                        {def.values.map(val => (
                                          <tr key={val.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-900">{val.value}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{val.display_name || "-"}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-center text-sm">
                                              <button onClick={(e) => toggleValueEnabled(val, e)}>
                                                <Badge variant={val.enabled ? "success" : "secondary"} className="cursor-pointer text-[10px] py-0">
                                                  {val.enabled ? "Active" : "Disabled"}
                                                </Badge>
                                              </button>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right text-sm">
                                              <button className="text-gray-400 hover:text-gray-900 mx-2" onClick={(e) => handleOpenEditValue(def, val, e)}>
                                                <Edit2 size={14} />
                                              </button>
                                              <button className="text-gray-400 hover:text-red-500" onClick={(e) => handleDeleteValue(val.id, e)}>
                                                <Trash2 size={14} />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-center py-6 bg-white border rounded-md text-sm text-gray-500 italic">
                                    No allowed values defined. Users can input any value.
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState 
              icon={<Tag size={48} className="text-gray-300" />}
              title={`No ${activeProvider} tags configured`}
              description="These tags will be available for users while tagging resources."
              className="py-24 bg-transparent border-0"
              action={
                <Button variant="outline" className={`mt-2 ${activeProvider === "AZURE" ? "text-azure border-azure/30 hover:bg-azure/5" : "text-aws border-aws/30 hover:bg-aws/5"}`} onClick={handleOpenAddDef}>
                  <Plus size={16} className="mr-2" /> Add First Tag
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Tag Def Modal */}
      {isDefModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-lg">{editingDef ? "Edit Tag Definition" : `Add ${activeProvider} Tag`}</h3>
              <button onClick={() => setIsDefModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Tag Key</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  disabled={!!editingDef}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-azure focus:border-azure font-mono disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="e.g. ENVIRONMENT"
                />
                {!editingDef && <p className="text-xs text-gray-500">Tag keys are automatically converted to uppercase.</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-azure focus:border-azure"
                  placeholder="Explain what this tag is used for"
                  rows={2}
                />
              </div>
              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-gray-700">Applies To</label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="applyAzure" 
                      checked={appliesToAzure} 
                      onChange={(e) => setAppliesToAzure(e.target.checked)}
                      className="h-4 w-4 text-azure border-gray-300 rounded focus:ring-azure"
                    />
                    <label htmlFor="applyAzure" className="text-sm text-gray-700">Azure</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="applyAws" 
                      checked={appliesToAws} 
                      onChange={(e) => setAppliesToAws(e.target.checked)}
                      className="h-4 w-4 text-aws border-gray-300 rounded focus:ring-aws"
                    />
                    <label htmlFor="applyAws" className="text-sm text-gray-700">AWS</label>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="mandatory" 
                  checked={mandatory} 
                  onChange={(e) => setMandatory(e.target.checked)}
                  className="h-4 w-4 text-azure border-gray-300 rounded focus:ring-azure"
                />
                <label htmlFor="mandatory" className="text-sm text-gray-700">Mandatory Tag</label>
              </div>
              <div className="flex items-center gap-2">
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
              <Button variant="outline" onClick={() => setIsDefModalOpen(false)}>Cancel</Button>
              <Button className={activeProvider === "AZURE" ? "bg-azure hover:bg-azure/90 text-white" : "bg-aws hover:bg-aws/90 text-white"} onClick={handleSaveDef} disabled={!name}>
                {editingDef ? "Save Changes" : "Create Tag"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Value Modal */}
      {isValueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-lg">{editingValue ? "Edit Tag Value" : "Add Tag Value"}</h3>
              <button onClick={() => setIsValueModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Value <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={val} 
                  onChange={(e) => setVal(e.target.value)}
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
                  value={valDisplayName} 
                  onChange={(e) => setValDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-azure focus:border-azure"
                  placeholder="e.g. Production Environment"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="valenabled" 
                  checked={valEnabled} 
                  onChange={(e) => setValEnabled(e.target.checked)}
                  className="h-4 w-4 text-azure border-gray-300 rounded focus:ring-azure"
                />
                <label htmlFor="valenabled" className="text-sm text-gray-700">Enabled</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 bg-gray-50 border-t">
              <Button variant="outline" onClick={() => setIsValueModalOpen(false)}>Cancel</Button>
              <Button className={activeProvider === "AZURE" ? "bg-azure hover:bg-azure/90 text-white" : "bg-aws hover:bg-aws/90 text-white"} onClick={handleSaveValue} disabled={!val}>
                {editingValue ? "Save Changes" : "Create Value"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Values Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-lg">Add Multiple Values</h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 bg-gray-50/50">
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Paste a list of values to add them in bulk.</p>
                <textarea 
                  value={bulkInput}
                  onChange={e => setBulkInput(e.target.value)}
                  placeholder="APP-A&#10;APP-B&#10;APP-C"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-azure focus:border-azure font-mono"
                  rows={8}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 bg-gray-50 border-t">
              <Button variant="outline" onClick={() => setIsBulkModalOpen(false)}>Cancel</Button>
              <Button className={activeProvider === "AZURE" ? "bg-azure hover:bg-azure/90 text-white" : "bg-aws hover:bg-aws/90 text-white"} onClick={handleSaveBulk} disabled={!bulkInput.trim()}>
                Save Values
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
