import { useState } from "react";
import { X, Search, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import type { TagDefinition, TagValue } from "../../services/api/tagging";
import { createAdminTagValuesBulk, deleteAdminTagValue } from "../../services/api/adminTags";
import { useAuth } from "../../contexts/AuthContext";

interface ManageValuesModalProps {
  tag: TagDefinition;
  onClose: () => void;
  onValuesChanged: () => void;
}

export function ManageValuesModal({ tag, onClose, onValuesChanged }: ManageValuesModalProps) {
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create a local copy to allow immediate UI updates
  const [values, setValues] = useState<TagValue[]>(tag.values || []);

  const handleBulkAdd = async () => {
    const token = await getToken();
    if (!token || !bulkInput.trim()) return;
    
    const lines = bulkInput.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const updatedValues = await createAdminTagValuesBulk(token, tag.id, lines);
      setValues(updatedValues);
      setBulkInput("");
      setIsAdding(false);
      onValuesChanged();
    } catch (err) {
      console.error(err);
      setError("Failed to add values.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (valueId: number) => {
    const token = await getToken();
    if (!token) return;
    try {
      await deleteAdminTagValue(token, valueId);
      // Update local state to reflect soft delete immediately
      setValues(prev => prev.map(v => v.id === valueId ? { ...v, enabled: false } : v));
      onValuesChanged();
    } catch (err) {
      console.error(err);
      setError("Failed to remove value.");
    }
  };

  // Only show enabled values, and filter by search
  const filteredValues = values
    .filter(v => v.enabled)
    .filter(v => search === "" || v.value.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <div>
            <h3 className="font-semibold text-lg">{tag.name} — Allowed Values</h3>
            <p className="text-xs text-gray-500 mt-0.5">Manage the strict dictionary of values for this tag.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b shrink-0 bg-gray-50/50">
          {!isAdding ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search values..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-azure focus:border-azure"
                />
              </div>
              <Button className="bg-azure hover:bg-azure/90 text-white gap-2 shrink-0" onClick={() => setIsAdding(true)}>
                <Plus size={16} /> Add Value
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Add Multiple Values</label>
                <button onClick={() => setIsAdding(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
              <textarea 
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                placeholder="Paste a list of values, one per line...&#10;APP-A&#10;APP-B&#10;APP-C"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-azure focus:border-azure font-mono"
                rows={5}
              />
              <div className="flex justify-end gap-2">
                <Button 
                  size="sm" 
                  className="bg-azure hover:bg-azure/90 text-white" 
                  onClick={handleBulkAdd}
                  disabled={loading || !bulkInput.trim()}
                >
                  {loading ? "Adding..." : "Save Values"}
                </Button>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {filteredValues.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-8">
              {search ? "No matching values found." : "No allowed values defined for this tag."}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredValues.map(v => (
                <div key={v.id} className="flex justify-between items-center py-2 px-3 hover:bg-gray-50 rounded-md group">
                  <span className="font-mono text-sm text-gray-700">{v.value}</span>
                  <button 
                    onClick={() => handleRemove(v.id)}
                    className="text-xs text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
