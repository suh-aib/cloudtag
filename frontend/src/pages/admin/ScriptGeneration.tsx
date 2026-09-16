import { useEffect, useState } from "react";
import { Download, Terminal } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../../contexts/AuthContext";
import { getScriptJobs, downloadScriptPackage } from "../../services/api/scripts";

interface ScriptJob {
  id: number;
  job_id: string;
  cloud: string;
  script_type: string;
  status: string;
  created_at: string;
}

export default function ScriptGeneration() {
  const { getToken } = useAuth();
  const [jobs, setJobs] = useState<ScriptJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJobs() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await getScriptJobs(token);
        setJobs(data);
      } catch (err) {
        console.error("Failed to load script jobs", err);
      } finally {
        setLoading(false);
      }
    }
    loadJobs();
  }, [getToken]);

  const handleDownload = async (jobId: string) => {
    try {
      const token = await getToken();
      if (!token) return;
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

  const renderStatus = (status: string) => {
    switch (status) {
      case 'GENERATED': return <Badge variant="default">Generated</Badge>;
      case 'COMPLETED': return <Badge variant="success">Completed</Badge>;
      case 'FAILED': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Script Generation</h1>
          <p className="text-sm text-gray-500 mt-1">Manage, download, and track the execution of infrastructure tagging scripts.</p>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading script jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Terminal className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Script Jobs Found</h3>
              <p>Go to the Approved Work tab to generate scripts for approved tags.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Cloud</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Generated At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-sm font-medium">{job.job_id}</TableCell>
                    <TableCell>{job.cloud}</TableCell>
                    <TableCell>{job.script_type}</TableCell>
                    <TableCell>{new Date(job.created_at).toLocaleString()}</TableCell>
                    <TableCell>{renderStatus(job.status)}</TableCell>
                    <TableCell className="text-right">
                      {job.status === 'GENERATED' && (
                        <button
                          onClick={() => handleDownload(job.job_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-azure hover:bg-azure/5 rounded"
                        >
                          <Download size={14} /> Download Package
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
