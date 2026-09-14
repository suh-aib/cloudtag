import { Activity } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";

export default function TaggingProgress() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tagging Progress</h1>
          <p className="text-sm text-gray-500 mt-1">Track the progress of tag assignments across the organization.</p>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          <EmptyState 
            icon={<Activity size={48} />}
            title="No progress data available"
            description="Progress metrics will appear once resources are imported and tagging begins."
            className="border-0 bg-transparent py-24"
          />
        </CardContent>
      </Card>
    </div>
  );
}
