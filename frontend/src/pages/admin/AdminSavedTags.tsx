import { Save } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";

export default function AdminSavedTags() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Saved Work</h1>
          <p className="text-sm text-gray-500 mt-1">All saved tagging work across all users.</p>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          <EmptyState 
            icon={<Save size={48} />}
            title="No saved work found"
            description="No users have saved any tagging progress."
            className="border-0 bg-transparent py-24"
          />
        </CardContent>
      </Card>
    </div>
  );
}
