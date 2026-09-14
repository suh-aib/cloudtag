import { Database, Activity, Clock, Users, Tags, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";

export default function AdminOverview() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admin Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide operations and compliance metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Users</p>
              <h3 className="text-3xl font-bold">...</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <Users size={24} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Tag Definitions</p>
              <h3 className="text-3xl font-bold text-indigo-600">0</h3>
            </div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <Tags size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Pending Approvals</p>
              <h3 className="text-3xl font-bold text-yellow-600">0</h3>
            </div>
            <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center">
              <Clock size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Assigned Tags</p>
              <h3 className="text-3xl font-bold text-green-600">0</h3>
            </div>
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
              <ShieldCheck size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>System Activity</CardTitle>
            <CardDescription>Recent administrative actions and system events.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState 
              icon={<Activity size={32} />}
              title="No events found"
              description="System audit logs will appear here once generated."
            />
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Resource Inventory Status</CardTitle>
            <CardDescription>Cloud resource ingestion summary.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState 
              icon={<Database size={32} />}
              title="No cloud resource data has been imported yet"
              description="Navigate to Data Sources to configure SharePoint or manually upload CSV data."
              action={<Button variant="outline">Go to Data Sources</Button>}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
