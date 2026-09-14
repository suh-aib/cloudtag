import { History } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";

export default function AuditLogs() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">System-wide audit trail of all platform activities.</p>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          <EmptyState 
            icon={<History size={48} />}
            title="No audit logs available"
            description="Audit logs will populate as users perform actions in the platform."
            className="border-0 bg-transparent py-24"
          />
        </CardContent>
      </Card>
    </div>
  );
}
