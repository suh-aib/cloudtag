import { useState, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { uploadCsvFile, detectCsvHeaders, validateCsvImport, executeCsvImport } from "../../services/api/csv";
import { AlertCircle, CheckCircle, Upload, Database, FileSearch, ArrowRight, Save, Cloud, Server } from "lucide-react";
import SharePointConfiguration from "../../components/admin/SharePointConfigurationContent";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/Tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";

export default function DataSources() {
  const { getToken } = useAuth();
  const [activeProvider, setActiveProvider] = useState<"azure" | "aws">("azure");
  const [activeSource, setActiveSource] = useState<"sharepoint" | "csv">("sharepoint");

  // CSV State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [mappings, setMappings] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Progress states
  const getStep = (): number => {
    if (!file) return 1; // 1. Upload
    if (!job) return 2; // 2. Inspect (reading file)
    if (job.status === "UPLOADED") return 3; // 3. Map & 4. Validate
    if (job.status === "READY_FOR_IMPORT") return 5; // 5. Preview
    if (job.status === "IMPORTING" || job.status === "COMPLETED") return 6; // 6. Import
    return 1;
  };

  const currentStep = getStep();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setJob(null);
      setMappings([]);
      setError(null);
      setSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const res = await uploadCsvFile(token, activeProvider, file);
      setJob(res);
      setSuccess("File uploaded successfully. Detecting headers...");
      
      // Auto-detect headers
      const detection = await detectCsvHeaders(token, activeProvider, res.id);
      setMappings(detection.headers);
      setJob((prev: any) => ({ ...prev, rows_total: detection.total_rows_detected }));
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateMapping = (index: number, field: string, value: any) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    setMappings(updated);
  };

  const handleValidate = async () => {
    if (!job) return;
    try {
      setError(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const validatedJob = await validateCsvImport(token, activeProvider, job.id, mappings);
      setJob(validatedJob);
      if (validatedJob.status === "FAILED") {
        setError(validatedJob.error_message);
      } else {
        setSuccess("Validation successful. Review the preview below.");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Validation failed");
    }
  };

  const handleImport = async () => {
    if (!job) return;
    try {
      setError(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const importedJob = await executeCsvImport(token, activeProvider, job.id);
      setJob(importedJob);
      if (importedJob.status === "COMPLETED") {
        setSuccess("Import completed successfully!");
      } else {
        setError(importedJob.error_message);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Import failed");
    }
  };

  const renderProgressSteps = () => {
    const steps = [
      { id: 1, name: "Upload" },
      { id: 2, name: "Inspect" },
      { id: 3, name: "Map" },
      { id: 4, name: "Validate" },
      { id: 5, name: "Preview" },
      { id: 6, name: "Import" }
    ];
    return (
      <div className="flex items-center justify-between w-full mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 z-0 rounded-full"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 z-0 rounded-full transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        ></div>
        
        {steps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2 ${
                isCompleted ? "bg-blue-600 border-blue-600 text-white" : 
                isCurrent ? "bg-white border-blue-600 text-blue-600" : 
                "bg-white border-gray-300 text-gray-400"
              }`}>
                {isCompleted ? <CheckCircle size={16} /> : step.id}
              </div>
              <span className={`mt-2 text-xs font-semibold ${
                isCurrent ? "text-blue-700" : 
                isCompleted ? "text-gray-700" : "text-gray-400"
              }`}>{step.name}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCsvUpload = () => (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle>Manual CSV Import</CardTitle>
          <CardDescription>Upload resource tag data via CSV mapping.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderProgressSteps()}

          {currentStep <= 2 && (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
              />
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4">
                <FileSearch size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Select CSV File</h3>
              <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
                Upload a CSV file exported from your cloud environment or CMDB to ingest tags.
              </p>
              
              {file ? (
                <div className="flex flex-col items-center w-full max-w-xs">
                  <div className="bg-white px-4 py-3 border rounded-lg w-full flex items-center justify-between mb-4 shadow-sm">
                    <span className="text-sm font-medium text-gray-700 truncate mr-4">{file.name}</span>
                    <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
                  </div>
                  <div className="flex gap-3 w-full">
                    <Button variant="outline" className="flex-1" onClick={() => setFile(null)}>Cancel</Button>
                    <Button className="flex-1" onClick={handleUpload} disabled={uploading}>
                      {uploading ? <Spinner className="w-4 h-4 mr-2 text-white" /> : <Upload className="w-4 h-4 mr-2" />}
                      Parse File
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => fileInputRef.current?.click()} size="lg">
                  Browse Files
                </Button>
              )}
            </div>
          )}

          {currentStep === 3 || currentStep === 4 ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900">Map Columns to Fields</h3>
                    <p className="text-sm text-blue-700">Review the auto-detected mapping for {job.rows_total} detected rows.</p>
                  </div>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Column</TableHead>
                    <TableHead>CloudTag Field</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Sample Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m, idx) => (
                    <TableRow key={idx} className={m.is_ignored ? "bg-gray-50 opacity-60" : ""}>
                      <TableCell className="font-mono text-sm font-medium">{m.source_header}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <select 
                            value={m.target_field || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated: Record<string, string> = { target_field: val };
                              if (val === "cloud_tag" && !m.target_tag_key) {
                                // Default tag key to column header
                                updated["target_tag_key"] = m.source_header;
                              }
                              const newMappings = [...mappings];
                              newMappings[idx] = { ...newMappings[idx], ...updated };
                              setMappings(newMappings);
                            }}
                            disabled={m.is_ignored}
                            className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                          >
                            <option value="">-- Unmapped --</option>
                            <optgroup label="Resource Metadata">
                              <option value="account_name">Account / Subscription Name</option>
                              <option value="account_id">Account / Subscription ID</option>
                              <option value="resource_group">Resource Group / VPC</option>
                              <option value="resource_name">Resource Name</option>
                              <option value="resource_type">Resource Type / Service</option>
                              <option value="region">Region / Location</option>
                              <option value="resource_id">Resource ID / ARN (Required)</option>
                              <option value="owner">Owner / Contact</option>
                              <option value="environment">Environment</option>
                            </optgroup>
                            <optgroup label="Current Cloud Tags">
                              <option value="serialized_tags">Existing Tags / AllTags</option>
                              <option value="cloud_tag">Individual Tag</option>
                            </optgroup>
                          </select>
                          
                          {m.target_field === "cloud_tag" && !m.is_ignored && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 font-medium">Tag Key:</span>
                              <input 
                                type="text"
                                value={m.target_tag_key || ""}
                                onChange={(e) => handleUpdateMapping(idx, "target_tag_key", e.target.value)}
                                className="flex-1 h-7 rounded border border-gray-300 px-2 text-xs"
                                placeholder="Tag Key"
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.confidence_score !== null && m.confidence_score > 0 ? (
                          <Badge variant={m.confidence_score >= 80 ? "success" : m.confidence_score >= 50 ? "warning" : "destructive"}>
                            {m.confidence_score >= 80 ? "HIGH" : m.confidence_score >= 50 ? "MEDIUM" : "LOW"} ({m.confidence_score}%)
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-500 font-mono truncate max-w-[150px]" title={m.sample_values?.join(", ")}>
                          {m.sample_values?.[0] || "No data"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={m.is_ignored} 
                            onChange={(e) => handleUpdateMapping(idx, "is_ignored", e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Ignore</span>
                        </label>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center pt-4 border-t mt-6">
                <Button variant="outline" onClick={() => { setJob(null); setFile(null); }}>Start Over</Button>
                <Button onClick={handleValidate} className="gap-2">
                  Validate Mapping <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          ) : null}

          {currentStep >= 5 && (
            <div className="space-y-6 max-w-6xl mx-auto py-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gray-50 border-gray-200">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-sm text-gray-500 font-medium mb-1">Valid Rows</span>
                    <span className="text-3xl font-bold text-gray-900">{job.rows_valid}</span>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-100">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-sm text-red-600 font-medium mb-1">Invalid Rows</span>
                    <span className="text-3xl font-bold text-red-700">{job.rows_invalid}</span>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-100">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-sm text-green-600 font-medium mb-1">New Resources</span>
                    <span className="text-3xl font-bold text-green-700">{job.stats_new}</span>
                  </CardContent>
                </Card>
                <Card className="bg-yellow-50 border-yellow-100">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-sm text-yellow-600 font-medium mb-1">Updates</span>
                    <span className="text-3xl font-bold text-yellow-700">{job.stats_updated}</span>
                  </CardContent>
                </Card>
              </div>
              
              {job.status === "READY_FOR_IMPORT" && (
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => { setJob(null); setFile(null); }}>Cancel</Button>
                  <Button 
                  onClick={handleImport}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2 font-medium"
                >
                  <Save size={16} /> Confirm Import
                </Button>
                </div>
              )}
              
              {job.status === "COMPLETED" && (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Import Successful</h3>
                  <p className="text-gray-500 mb-6">Your CSV data has been successfully imported.</p>
                  <Button onClick={() => { setJob(null); setFile(null); }}>Import Another File</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Data Sources</h1>
        <p className="text-sm text-gray-500 mt-1">Configure automated inventory sources or perform manual CSV ingestions.</p>
      </div>

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-md flex items-center gap-2 border border-green-200 shadow-sm">
          <CheckCircle size={18} />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center gap-2 border border-red-200 shadow-sm">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <Tabs>
        <TabsList className="mb-4">
          <TabsTrigger 
            value="azure" 
            activeValue={activeProvider} 
            onValueChange={(v) => { setActiveProvider(v as "azure"); setJob(null); setFile(null); }} 
            className="gap-2"
            customActiveClass="bg-azure/10 text-azure border-azure/30"
          >
            <Cloud size={16} /> Azure Integration
          </TabsTrigger>
          <TabsTrigger 
            value="aws" 
            activeValue={activeProvider} 
            onValueChange={(v) => { setActiveProvider(v as "aws"); setJob(null); setFile(null); }} 
            className="gap-2"
            customActiveClass="bg-aws/10 text-aws border-aws/30"
          >
            <Server size={16} /> AWS Integration
          </TabsTrigger>
        </TabsList>

        <div className="mt-6 flex gap-2">
          <Button 
            variant={activeSource === "sharepoint" ? "default" : "outline"} 
            onClick={() => setActiveSource("sharepoint")}
          >
            SharePoint Configuration
          </Button>
          <Button 
            variant={activeSource === "csv" ? "default" : "outline"} 
            onClick={() => setActiveSource("csv")}
            className="gap-2"
          >
            <Database size={16} /> Manual CSV Upload
          </Button>
        </div>

        <div className="mt-6">
          {activeSource === "sharepoint" ? (
            <SharePointConfiguration provider={activeProvider} />
          ) : (
            renderCsvUpload()
          )}
        </div>
      </Tabs>
    </div>
  );
}
