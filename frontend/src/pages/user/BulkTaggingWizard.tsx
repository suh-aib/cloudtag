import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tag, ArrowLeft, Save, Eye, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { useAuth } from "../../contexts/AuthContext";
import { getTagDefinitions, previewBulkTagging, createBulkTaggingProposal } from "../../services/api/tagging";
import type { TagDefinition, ScopeType, PreviewResponse } from "../../services/api/tagging";

export default function BulkTaggingWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getToken } = useAuth();
  
  const provider = searchParams.get('provider') as 'AZURE' | 'AWS' | null;
  const scopeType = searchParams.get('scopeType') as ScopeType | null;
  const accountId = searchParams.get('accountId') || undefined;
  const resourceGroup = searchParams.get('resourceGroup') || undefined;
  const resourceType = searchParams.get('resourceType') || undefined;
  const resourceIdsParam = searchParams.get('resourceIds');
  const resourceIds = resourceIdsParam ? resourceIdsParam.split(',').map(Number) : undefined;
  
  const [step, setStep] = useState<1 | 2>(1);
  const [tagDefs, setTagDefs] = useState<TagDefinition[]>([]);
  const [selectedTags, setSelectedTags] = useState<Record<string, string>>({});
  
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  const [submitLoading, setSubmitLoading] = useState(false);
  
  useEffect(() => {
    if (!provider || !scopeType) {
      navigate('/bulk-tagging');
      return;
    }
    
    getToken().then(token => {
      if (token) {
        getTagDefinitions(token).then(defs => {
          // Filter by provider
          const activeDefs = defs.filter(d => d.enabled && d.provider === provider);
          setTagDefs(activeDefs);
        }).catch(console.error);
      }
    });
  }, [provider, scopeType, navigate, getToken]);

  const handleTagChange = (tagName: string, value: string) => {
    setSelectedTags(prev => {
      const next = { ...prev };
      if (value === "") {
        delete next[tagName];
      } else {
        next[tagName] = value;
      }
      return next;
    });
  };

  const hasAnyTagsSelected = Object.keys(selectedTags).length > 0;

  const loadPreview = async () => {
    if (!hasAnyTagsSelected) return;
    
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const token = await getToken();
      if (!token) return;
      
      const payload = {
        provider: provider!,
        scope_type: scopeType!,
        account_id: accountId,
        resource_group: resourceGroup,
        resource_type: resourceType,
        resource_ids: resourceIds,
        tags: selectedTags
      };
      
      const response = await previewBulkTagging(token, payload);
      setPreviewData(response);
      setStep(2);
    } catch (err: any) {
      console.error(err);
      setPreviewError(err.response?.data?.detail || "Failed to load preview. Please try again.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (status: string = "PENDING_APPROVAL") => {
    setSubmitLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      
      const payload = {
        provider: provider!,
        scope_type: scopeType!,
        account_id: accountId,
        resource_group: resourceGroup,
        resource_type: resourceType,
        resource_ids: resourceIds,
        tags: selectedTags,
        status: status
      };
      
      await createBulkTaggingProposal(token, payload);
      
      if (status === "DRAFT") {
        navigate('/saved-tags', { state: { successMessage: "Bulk tagging work saved as draft." } });
      } else {
        navigate('/my-submissions', { state: { successMessage: "Bulk tagging proposal submitted successfully and is pending approval." } });
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to submit proposal.");
      setSubmitLoading(false);
    }
  };

  const renderScopeSummary = () => {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div><span className="text-gray-500">Cloud:</span> <span className="font-semibold text-gray-900">{provider}</span></div>
        <div><span className="text-gray-500">Scope Type:</span> <span className="font-semibold text-gray-900">{scopeType}</span></div>
        {accountId && <div><span className="text-gray-500">Account:</span> <span className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border">{accountId}</span></div>}
        {resourceGroup && <div><span className="text-gray-500">Group:</span> <span className="font-semibold text-gray-900">{resourceGroup}</span></div>}
        {resourceType && <div><span className="text-gray-500">Type:</span> <span className="font-semibold text-gray-900">{resourceType}</span></div>}
        {resourceIds && <div><span className="text-gray-500">Selected Resources:</span> <span className="font-semibold text-gray-900">{resourceIds.length}</span></div>}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => step === 2 ? setStep(1) : navigate(-1)} className="text-gray-500">
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Tag className="text-purple-500" /> Bulk Tagging Wizard
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={step === 1 ? "text-purple-600" : "text-gray-400"}>1. Configure</span>
          <span className="text-gray-300">-----</span>
          <span className={step === 2 ? "text-purple-600" : "text-gray-400"}>2. Preview & Save</span>
        </div>
      </div>

      {renderScopeSummary()}

      {step === 1 && (
        <Card className="animate-in fade-in duration-300">
          <CardHeader>
            <CardTitle>Configure Tags</CardTitle>
            <CardDescription>Select the values you want to apply. Leave at "Don't Change" to preserve existing tags.</CardDescription>
          </CardHeader>
          <CardContent>
            {previewError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-md flex items-start gap-2">
                <ShieldAlert size={16} className="mt-0.5" />
                {previewError}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {tagDefs.map(def => (
                <div key={def.name} className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    {def.name}
                    {def.mandatory && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold tracking-wider">REQUIRED</span>}
                  </label>
                  <select
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm p-2 border bg-white"
                    value={selectedTags[def.name] || ""}
                    onChange={(e) => handleTagChange(def.name, e.target.value)}
                  >
                    <option value="">Don't Change</option>
                    {def.values.filter(v => v.enabled).map(v => (
                      <option key={v.value} value={v.value}>{v.value}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <Button 
                size="lg" 
                className="bg-purple-600 hover:bg-purple-700 text-white gap-2" 
                disabled={!hasAnyTagsSelected || previewLoading}
                onClick={loadPreview}
              >
                {previewLoading ? "Generating Preview..." : "Preview Changes"} <Eye size={18} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && previewData && (
        <Card className="animate-in fade-in slide-in-from-right-4 duration-300 border-purple-100 shadow-md">
          <CardHeader className="bg-purple-50/50 border-b border-purple-100 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-purple-900">Preview Changes</CardTitle>
                <CardDescription className="text-purple-700/70 mt-1">
                  Review the proposed tags before submitting for approval. Unchanged tags will be skipped.
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Resources in Scope</div>
                <div className="text-2xl font-bold text-gray-900">{previewData.resource_count}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {previewData.changes.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle2 size={48} className="mx-auto text-green-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No Changes Required</h3>
                <p className="text-sm">The existing tags on these resources already match your configuration exactly.</p>
                <Button variant="outline" className="mt-4" onClick={() => setStep(1)}>Go Back</Button>
              </div>
            ) : (
              <div>
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 sticky top-0 border-b z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700">Resource Name</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Tag</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 text-center">Current Value</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 text-center">Proposed Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData.changes.map((change, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2 font-medium text-gray-900 truncate max-w-[200px]" title={change.resource_name}>
                            {change.resource_name}
                          </td>
                          <td className="px-4 py-2 text-gray-600 font-mono text-xs">{change.tag_key}</td>
                          <td className="px-4 py-2 text-center">
                            {change.current_value === 'ABSENT' ? (
                              <span className="text-gray-400 italic text-xs">None</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs border">
                                {change.current_value}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {change.will_change ? (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs border border-purple-200 font-medium">
                                {change.proposed_value}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-xs flex items-center justify-center gap-1">
                                <CheckCircle2 size={12} /> No Change
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-900">{previewData.changes.filter(c => c.will_change).length}</span> actual changes will be proposed.
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      size="lg" 
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleSubmit("DRAFT")}
                      disabled={submitLoading || previewData.changes.filter(c => c.will_change).length === 0}
                    >
                      {submitLoading ? "Saving..." : "Save as Draft"}
                    </Button>
                    <Button 
                      size="lg" 
                      className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                      onClick={() => handleSubmit("PENDING_APPROVAL")}
                      disabled={submitLoading || previewData.changes.filter(c => c.will_change).length === 0}
                    >
                      {submitLoading ? "Submitting..." : "Submit Proposal"} <Save size={18} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
