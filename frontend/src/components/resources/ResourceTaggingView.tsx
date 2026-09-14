import { useState } from "react";
import { Tag, Save, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/Tabs";

export default function ResourceTaggingView() {
  const [activeTab, setActiveTab] = useState("overview");

  // This is a purely structural component for when real data is available.
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Resource Name Placeholder</h2>
        <Badge variant="success" className="uppercase">Running</Badge>
      </div>

      <Tabs>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" activeValue={activeTab} onValueChange={setActiveTab}>Overview</TabsTrigger>
          <TabsTrigger value="tags" activeValue={activeTab} onValueChange={setActiveTab}>Tags</TabsTrigger>
          <TabsTrigger value="cost" activeValue={activeTab} onValueChange={setActiveTab} className="text-gray-400">Cost (Coming Soon)</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" activeValue={activeTab}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Basic Information */}
            <div className="space-y-6">
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-semibold">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {[
                        { label: "Resource Name", value: "-" },
                        { label: "Resource Type", value: "-" },
                        { label: "Resource Group", value: "-" },
                        { label: "Subscription", value: "-" },
                        { label: "Location", value: "-" },
                        { label: "Resource ID", value: "-" },
                      ].map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4 text-gray-500 font-medium w-1/3">{item.label}</td>
                          <td className="py-3 px-4 text-gray-900 font-mono text-xs truncate max-w-[200px]">{item.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-semibold">Existing Tags (Other)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-4 text-left font-medium text-gray-500">Tag Key</th>
                        <th className="py-2 px-4 text-left font-medium text-gray-500">Tag Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-gray-400 italic">No existing tags</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Dynamic Tagging UI */}
            <div className="space-y-6">
              <Card className="shadow-sm border-gray-200 border-t-4 border-t-azure">
                <CardHeader className="pb-4 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Tag size={16} className="text-azure" /> Tags (Cloud Cost Allocation)
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 text-gray-500 hover:text-gray-900 gap-1.5">
                    <RotateCcw size={14} /> Reset
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="text-sm text-gray-500 text-center py-8 italic">
                    Tag definitions will be dynamically loaded here.
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" className="text-gray-600">Cancel</Button>
                    <Button className="bg-azure hover:bg-azure/90 text-white gap-2">
                      <Save size={16} /> Save Tags
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
