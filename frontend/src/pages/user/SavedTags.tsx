import { Save, Cloud } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { getBatches, type BatchResponse } from "../../services/api/tagging";
import { useAuth } from "../../contexts/AuthContext";

export default function SavedTags() {
  const { getToken } = useAuth();
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBatches() {
      try {
        const token = await getToken();
        if (token) {
          const data = await getBatches(token, "DRAFT");
          setBatches(data);
        }
      } catch (err) {
        console.error("Failed to load drafts", err);
      } finally {
        setLoading(false);
      }
    }
    loadBatches();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Saved Tags</h1>
          <p className="text-sm text-gray-500 mt-1">Your saved tagging work that hasn't been submitted.</p>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : batches.length === 0 ? (
            <EmptyState 
              icon={<Save size={48} />}
              title="No saved work"
              description="You haven't saved any tagging progress yet."
              className="border-0 bg-transparent py-24"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Cloud</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Saved At</TableHead>
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
                    <TableCell className="text-gray-500">{batch.scope}</TableCell>
                    <TableCell className="text-gray-500">{new Date(batch.created_at).toLocaleString()}</TableCell>
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
