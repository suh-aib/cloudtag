import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Download, ArrowLeft, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Terminal, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../../contexts/AuthContext";
import { getScriptJobDetail, downloadScriptPackage, getScriptJobPreview } from "../../services/api/scripts";

// Tree structure interfaces
interface TreeNode {
  id: string;
  name: string;
  type: "account" | "region_rg" | "resource_type" | "resource";
  children: Record<string, TreeNode>;
  resourceData?: any; // Only populated for "resource" level
  isExpanded: boolean;
}

export default function ScriptJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Script preview state
  const [preview, setPreview] = useState<{apply_script: string, revert_script: string} | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState<"apply" | "revert" | null>(null);
  const [copied, setCopied] = useState(false);

  // Selected resource for the change detail panel
  const [selectedResource, setSelectedResource] = useState<any | null>(null);

  // Tree state
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  // We use a flat set to track expanded nodes by ID for fast toggle
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadJob() {
      try {
        const token = await getToken();
        if (!token || !jobId) return;
        const data = await getScriptJobDetail(token, jobId);
        setJob(data);
        
        // Build Tree
        const root: TreeNode = { id: "root", name: "Root", type: "account", children: {}, isExpanded: true };
        const initialExpanded = new Set<string>();
        initialExpanded.add("root");

        data.manifest.resources.forEach((res: any) => {
          // Account level
          const accountKey = res.account_id || "Unknown Account";
          const accountName = res.account_name ? `${res.account_name} (${accountKey})` : accountKey;
          if (!root.children[accountKey]) {
            root.children[accountKey] = { id: accountKey, name: accountName, type: "account", children: {}, isExpanded: true };
            initialExpanded.add(accountKey);
          }
          
          // Region or RG level
          const rgRegionKey = data.cloud === 'AWS' ? (res.region || "Global") : (res.resource_group || "No Resource Group");
          const accountNode = root.children[accountKey];
          if (!accountNode.children[rgRegionKey]) {
            accountNode.children[rgRegionKey] = { id: `${accountKey}-${rgRegionKey}`, name: rgRegionKey, type: "region_rg", children: {}, isExpanded: true };
            initialExpanded.add(`${accountKey}-${rgRegionKey}`);
          }

          // Resource Type level
          const typeKey = res.resource_type || "Unknown Type";
          const rgNode = accountNode.children[rgRegionKey];
          if (!rgNode.children[typeKey]) {
            rgNode.children[typeKey] = { id: `${accountKey}-${rgRegionKey}-${typeKey}`, name: typeKey, type: "resource_type", children: {}, isExpanded: false };
            // don't auto-expand resource types
          }

          // Resource level
          const typeNode = rgNode.children[typeKey];
          const resourceKey = res.resource_id;
          typeNode.children[resourceKey] = {
            id: resourceKey,
            name: res.resource_name || resourceKey,
            type: "resource",
            children: {},
            resourceData: res,
            isExpanded: false
          };
        });

        setTreeData(root);
        setExpandedNodes(initialExpanded);

        // Pre-select first resource if exists
        if (data.manifest.resources.length > 0) {
          setSelectedResource(data.manifest.resources[0]);
        }
      } catch (err: any) {
        console.error("Failed to load script job detail", err);
        setError(err.message || "Failed to load job details.");
      } finally {
        setLoading(false);
      }
    }
    loadJob();
  }, [getToken, jobId]);

  const loadPreview = async (type: "apply" | "revert") => {
    setLoadingPreview(true);
    setShowScriptModal(type);
    setCopied(false);
    
    if (preview) {
      setLoadingPreview(false);
      return;
    }
    
    setLoadingPreview(true);
    try {
      const token = await getToken();
      if (!token || !jobId) return;
      const data = await getScriptJobPreview(token, jobId);
      setPreview(data);
    } catch (err: any) {
      alert(`Error loading scripts: ${err.message}`);
      setShowScriptModal(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async () => {
    try {
      const token = await getToken();
      if (!token || !jobId) return;
      const blob = await downloadScriptPackage(token, jobId);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CloudTag-${jobId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Error downloading script package: ${err.message}`);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  if (loading) return <div className="p-12 text-center text-gray-500">Loading script job details...</div>;

  if (error || !job) {
    return (
      <div className="p-12 text-center text-red-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-1">Error</h3>
        <p>{error || "Job not found"}</p>
        <button onClick={() => navigate("/admin/script-generation")} className="mt-4 text-azure hover:underline">
          Return to list
        </button>
      </div>
    );
  }

  // Calculate metrics
  let totalResources = job.manifest.resources.length;
  let addCount = 0;
  let changeCount = 0;
  let preserveCount = 0;
  let removeCount = 0;

  job.manifest.resources.forEach((res: any) => {
    res.changes.forEach((chg: any) => {
      if (chg.action === "ADD") addCount++;
      else if (chg.action === "CHANGE") changeCount++;
      else if (chg.action === "PRESERVE") preserveCount++;
      else if (chg.action === "REMOVE") removeCount++;
    });
  });

  const renderTree = (node: TreeNode, level: number = 0): React.ReactNode => {
    if (node.id === "root") {
      return Object.values(node.children).map(child => renderTree(child, level));
    }

    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = Object.keys(node.children).length > 0;
    const isResource = node.type === "resource";
    const isSelected = isResource && selectedResource?.resource_id === node.resourceData?.resource_id;

    return (
      <div key={node.id}>
        <div 
          className={`flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 cursor-pointer text-sm ${isSelected ? 'bg-blue-50 border-r-2 border-azure' : ''}`}
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
          onClick={() => {
            if (isResource) {
              setSelectedResource(node.resourceData);
            } else {
              toggleNode(node.id);
            }
          }}
        >
          <div className="w-4 h-4 flex items-center justify-center">
            {hasChildren && (
              isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />
            )}
          </div>
          <span className={`truncate ${isResource ? 'text-gray-600' : 'font-medium text-gray-800'}`}>
            {node.name}
          </span>
          {!isResource && <span className="text-xs text-gray-400">({Object.keys(node.children).length})</span>}
        </div>
        {isExpanded && hasChildren && (
          <div className="border-l border-gray-100 ml-3">
            {Object.values(node.children).map(child => renderTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/admin/script-generation")} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Script Job: {job.job_id}</h1>
            <p className="text-sm text-gray-500 mt-1">Review approved changes and canonical execution scripts.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => loadPreview("apply")} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 shadow-sm">
            <Eye size={16} /> View Apply Script
          </button>
          <button onClick={() => loadPreview("revert")} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 shadow-sm">
            <Eye size={16} /> View Revert Script
          </button>
          <button onClick={handleDownload} className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-azure rounded hover:bg-azure-dark shadow-sm">
            <Download size={16} /> Download Package
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1 shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
            <CardTitle className="text-sm font-medium text-gray-700">Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <span className="block text-xs text-gray-500 font-medium uppercase tracking-wider">Provider</span>
              <span className="block mt-1 font-medium">{job.cloud}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 font-medium uppercase tracking-wider">Status</span>
              <Badge variant="success" className="mt-1">{job.status}</Badge>
            </div>
            <div>
              <span className="block text-xs text-gray-500 font-medium uppercase tracking-wider">Integrity</span>
              <span className="mt-1 text-green-600 font-medium flex items-center gap-1"><CheckCircle size={14} /> Valid</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 font-medium uppercase tracking-wider">Resources</span>
              <span className="block mt-1 font-medium">{totalResources}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-1 shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
            <CardTitle className="text-sm font-medium text-gray-700">Change Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-600">ADD</span>
              <span className="font-bold">{addCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-azure">CHANGE</span>
              <span className="font-bold">{changeCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-red-500">REMOVE</span>
              <span className="font-bold">{removeCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">PRESERVE</span>
              <span className="font-bold">{preserveCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm border-gray-200">
          <div className="flex h-full min-h-[400px]">
            {/* Tree Sidebar */}
            <div className="w-1/2 border-r border-gray-200 overflow-y-auto max-h-[500px]">
              <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-3 z-10">
                <h3 className="text-sm font-medium text-gray-700">Resource Hierarchy</h3>
              </div>
              <div className="p-2">
                {treeData && renderTree(treeData)}
              </div>
            </div>
            
            {/* Detail Panel */}
            <div className="w-1/2 overflow-y-auto max-h-[500px]">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
                <h3 className="text-sm font-medium text-gray-700">Changes</h3>
              </div>
              <div className="p-4">
                {selectedResource ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium text-gray-900 truncate" title={selectedResource.resource_name}>{selectedResource.resource_name}</h4>
                      <p className="text-xs text-gray-500 break-all mt-1">{selectedResource.resource_id}</p>
                    </div>
                    
                    <div className="space-y-3">
                      {selectedResource.changes.map((chg: any, idx: number) => (
                        <div key={idx} className="border border-gray-200 rounded-md p-3 bg-gray-50">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-900 text-sm">{chg.key}</span>
                            {chg.action === 'ADD' && <Badge variant="success">ADD</Badge>}
                            {chg.action === 'CHANGE' && <Badge variant="info">CHANGE</Badge>}
                            {chg.action === 'REMOVE' && <Badge variant="destructive">REMOVE</Badge>}
                            {chg.action === 'PRESERVE' && <Badge variant="secondary">PRESERVE</Badge>}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                            <div>
                              <span className="block text-xs text-gray-500 mb-1">Before:</span>
                              <span className={chg.before === null ? "text-gray-400 italic" : "text-gray-800"}>
                                {chg.before === null ? "NOT SET" : chg.before}
                              </span>
                            </div>
                            <div>
                              <span className="block text-xs text-gray-500 mb-1">After:</span>
                              <span className={chg.after === null ? "text-gray-400 italic" : "text-gray-800 font-medium"}>
                                {chg.after === null ? "NOT SET" : chg.after}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-12">
                    <AlertCircle size={32} className="mb-2 opacity-50" />
                    <p className="text-sm">Select a resource to view changes</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Terminal size={20} className="text-gray-500" />
                {showScriptModal === "apply" ? "Apply Script" : "Revert Script"}
              </h2>
              <button onClick={() => setShowScriptModal(null)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-gray-900 text-gray-100 flex-1 rounded-b-lg rounded-t-none text-left">
              {loadingPreview ? (
                <div className="text-center py-12 text-gray-400">Loading script...</div>
              ) : preview ? (
                <pre className="text-sm font-mono whitespace-pre-wrap">
                  <code>{showScriptModal === "apply" ? preview.apply_script : preview.revert_script}</code>
                </pre>
              ) : (
                <div className="text-center py-12 text-red-400">Failed to load script content.</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between rounded-b-lg">
              <button 
                onClick={() => {
                  if (preview) {
                    const content = showScriptModal === "apply" ? preview.apply_script : preview.revert_script;
                    navigator.clipboard.writeText(content);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                disabled={!preview || loadingPreview}
                className="px-4 py-2 bg-azure border border-transparent rounded text-sm font-medium text-white hover:bg-azure-dark disabled:opacity-50"
              >
                {copied ? "Copied!" : "Copy Script"}
              </button>
              <button 
                onClick={() => setShowScriptModal(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
