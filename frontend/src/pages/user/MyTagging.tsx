import { Tag } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import ResourceTaggingView from "../../components/resources/ResourceTaggingView";

export default function MyTagging() {
  const hasResources = false; // Placeholder logic until API is integrated

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Tagging</h1>
          <p className="text-sm text-gray-500 mt-1">Review your cloud resources and assign tags.</p>
        </div>
      </div>

      {hasResources ? (
        <ResourceTaggingView />
      ) : (
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-0">
            <EmptyState 
              icon={<Tag size={48} className="text-azure/40" />}
              title="No resources assigned to you"
              description="There are no cloud resources currently awaiting your tagging review."
              className="border-0 bg-transparent py-24"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
