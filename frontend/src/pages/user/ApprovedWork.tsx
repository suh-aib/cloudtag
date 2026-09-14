import { CheckCircle, Cloud, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { getBatches, type BatchResponse } from "../../services/api/tagging";
import { useAuth } from "../../contexts/AuthContext";

export default function ApprovedWork() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBatches() {
      try {
        const token = await getToken();
        if (token) {
          const data = await getBatches(token);
          const approvedStatuses = ['APPROVED', 'PARTIALLY_APPROVED', 'ASSIGNED', 'SCRIPT_GENERATED', 'APPLIED', 'VALIDATED'];
          setBatches(data.filter(b => approvedStatuses.includes(b.status)));
        }
      } catch (err) {
        console.error("Failed to load approved work", err);
      } finally {
        setLoading(false);
      }
    }
    loadBatches();
  }, []);

  const renderStatus = (status: string) => {
    switch (status) {
      case 'APPROVED': return <Badge variant="success">Approved</Badge>;
      case 'PARTIALLY_APPROVED': return <Badge variant="warning">Partial</Badge>;
      case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Approved Work</h1>
          <p className="text-sm text-gray-500 mt-1">Your tagging submissions that have been approved by administrators.</p>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading approved work...</div>
          ) : batches.length === 0 ? (
            <EmptyState 
              icon={<CheckCircle size={48} />}
              title="No approved work yet"
              description="You don't have any approved tagging submissions."
              className="border-0 bg-transparent py-24"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submission ID</TableHead>
                  <TableHead>Cloud</TableHead>
                  <TableHead>Subscription / Account</TableHead>
                  <TableHead>Approved Resources</TableHead>
                  <TableHead>Approved At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium font-mono text-xs">{batch.batch_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Cloud size={14} className={batch.cloud === 'AZURE' ? 'text-blue-600' : 'text-orange-500'} />
                        {batch.cloud}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-900 font-medium">{batch.scope}</TableCell>
                    <TableCell className="text-gray-700">{batch.resource_count}</TableCell>
                    <TableCell className="text-gray-500">{new Date(batch.created_at).toLocaleString()}</TableCell>
                    <TableCell>{renderStatus(batch.status)}</TableCell>
                    <TableCell className="text-right">
                      <button 
                        onClick={() => navigate(`/my-submissions/${batch.batch_id}`)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-azure hover:text-azure-dark"
                      >
                        View <ArrowRight size={14} />
                      </button>
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
