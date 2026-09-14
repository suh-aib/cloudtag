import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Tag, ShieldAlert, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuth } from "../../contexts/AuthContext";
import { getAdminTagDefinitions, createAdminTagDefinition, updateAdminTagDefinition, deleteAdminTagDefinition } from "../../services/api/adminTags";
import type { TagDefinition } from "../../services/api/tagging";
import { ManageValuesModal } from "../../components/tagging/ManageValuesModal";

export default function TagConfiguration() {
  const { getToken } = useAuth();
  const [activeProvider, setActiveProvider] = useState<"AZURE" | "AWS" | "SHARED">("AZURE");
  const [definitions, setDefinitions] = useState<TagDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<TagDefinition | null>(null);
  
  // Manage values state
  const [managingTag, setManagingTag] = useState<TagDefinition | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [appliesToAzure, setAppliesToAzure] = useState(true);
  const [appliesToAws, setAppliesToAws] = useState(false);

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

  const handleOpenAdd = () => {
    setEditingDef(null);
    setName("");
    setDescription("");
    setMandatory(false);
    setEnabled(true);
    setAppliesToAzure(activeProvider === "AZURE");
    setAppliesToAws(activeProvider === "AWS");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (def: TagDefinition) => {
    setEditingDef(def);
    setName(def.name);
    setDescription(def.description || "");
    setMandatory(def.mandatory);
    setEnabled(def.enabled);
    setAppliesToAzure(def.provider === "AZURE" || def.provider === "SHARED");
    setAppliesToAws(def.provider === "AWS" || def.provider === "SHARED");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
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
      setIsModalOpen(false);
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to save definition", err);
      alert("Failed to save tag definition. Does a tag with this name already exist?");
    }
  };

  const handleDelete = async (id: number) => {
    const token = await getToken();
    if (!token || !confirm("Are you sure you want to delete this tag and all its allowed values?")) return;
    try {
      await deleteAdminTagDefinition(token, id);
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to delete definition", err);
    }
  };

  const toggleEnabled = async (def: TagDefinition) => {
    const token = await getToken();
    if (!token) return;
    try {
      await updateAdminTagDefinition(token, def.id, { enabled: !def.enabled });
      fetchDefinitions();
    } catch (err) {
      console.error("Failed to toggle definition", err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tag Configuration</h1>
          <p className="text-sm text-gray-500">Manage tag keys and allowed values for each cloud.</p>
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
            onClick={handleOpenAdd}
          >
            <Plus size={16} /> Add Tag
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : definitions.length > 0 ? (
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow>
                  <TableHead className="font-semibold text-gray-700 pl-6">Tag Key</TableHead>
                  <TableHead className="font-semibold text-gray-700">Requirement</TableHead>
                  <TableHead className="font-semibold text-gray-700">Allowed Values</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-center">Status</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700 pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {definitions.map((def) => (
                  <TableRow key={def.id}>
                    <TableCell className="pl-6">
                      <div className="font-mono text-sm font-medium flex items-center gap-2">
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
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {def.values ? def.values.filter(v => v.enabled).length : 0} values
                        <button 
                          onClick={() => setManagingTag(def)}
                          className="flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                          title="Manage values"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <button onClick={() => toggleEnabled(def)} className="focus:outline-none">
                        <Badge variant={def.enabled ? "success" : "secondary"} className="cursor-pointer">
                          {def.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" className={`${activeProvider === "AZURE" ? "text-azure hover:text-azure hover:bg-azure/10" : "text-aws hover:text-aws hover:bg-aws/10"} gap-1.5 h-8`} onClick={() => handleOpenEdit(def)}>
                        <Edit2 size={14} /> Edit
                      </Button>
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500 h-8 w-8 ml-1" onClick={() => handleDelete(def.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState 
              icon={<Tag size={48} className="text-gray-300" />}
              title={`No ${activeProvider} tags configured`}
              description="These tags will be available for users while tagging resources."
              className="py-24 bg-transparent border-0"
              action={
                <Button variant="outline" className={`mt-2 ${activeProvider === "AZURE" ? "text-azure border-azure/30 hover:bg-azure/5" : "text-aws border-aws/30 hover:bg-aws/5"}`} onClick={handleOpenAdd}>
                  <Plus size={16} className="mr-2" /> Add First Tag
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-lg">{editingDef ? "Edit Tag Definition" : `Add ${activeProvider} Tag`}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
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
                      disabled={false} // Allow changing provider
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
                      disabled={false}
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
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button className={activeProvider === "AZURE" ? "bg-azure hover:bg-azure/90 text-white" : "bg-aws hover:bg-aws/90 text-white"} onClick={handleSave} disabled={!name}>
                {editingDef ? "Save Changes" : "Create Tag"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Values Modal */}
      {managingTag && (
        <ManageValuesModal 
          tag={managingTag}
          onClose={() => setManagingTag(null)}
          onValuesChanged={() => fetchDefinitions()}
        />
      )}
    </div>
  );
}
