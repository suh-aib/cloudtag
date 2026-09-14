import { Cloud, Server, Activity, Tag, ArrowRight, ShieldCheck, Clock, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";
import { getDashboardStats, type DashboardStats } from "../../services/api/inventory";

export default function Dashboard() {
  const { user, getToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    getToken().then(token => {
      if (token) {
        getDashboardStats(token).then(setStats).catch(console.error);
      }
    });
  }, [getToken]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Welcome back, {user?.display_name?.split(' ')[0] || 'User'}!
        </h1>
        <p className="text-gray-500">Let's keep your cloud organized.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-azure-light flex items-center justify-center mb-2">
              <Cloud size={32} className="text-azure" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Explore Azure Resources</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-[250px] mx-auto">
                Browse, view and add tags to Azure resources.
              </p>
            </div>
            <Button asChild className="bg-azure hover:bg-azure/90 text-white mt-2">
              <Link to="/azure">
                Open Azure <ArrowRight size={16} className="ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-aws-light flex items-center justify-center mb-2">
              <Server size={32} className="text-aws" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Explore AWS Resources</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-[250px] mx-auto">
                Browse, view and add tags to AWS resources.
              </p>
            </div>
            <Button asChild className="bg-aws hover:bg-aws/90 text-white mt-2">
              <Link to="/aws">
                Open AWS <ArrowRight size={16} className="ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="text-gray-500"><Server size={28} strokeWidth={2.5} /></div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-gray-900">{stats?.total_resources || 0}</h3>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Total Resources</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="text-indigo-500"><Tag size={28} strokeWidth={2.5} /></div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-gray-900">{stats?.tagging_required || 0}</h3>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Tagging Required</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="text-amber-500"><Clock size={28} strokeWidth={2.5} /></div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-gray-900">{stats?.pending_approval_resources || 0}</h3>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Pending Approval</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="text-green-500"><ShieldCheck size={28} strokeWidth={2.5} /></div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-gray-900">{stats?.validated_resources || 0}</h3>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Validated</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="text-blue-500"><Percent size={28} strokeWidth={2.5} /></div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-gray-900">{stats?.tagging_completion_percent || 0}%</h3>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Completion</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
          <Button variant="link" className="text-blue-600 font-medium">View All</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-transparent">
              <TableRow className="border-b-gray-200">
                <TableHead className="text-xs uppercase text-gray-500 font-semibold tracking-wider">Date</TableHead>
                <TableHead className="text-xs uppercase text-gray-500 font-semibold tracking-wider">Resource</TableHead>
                <TableHead className="text-xs uppercase text-gray-500 font-semibold tracking-wider">Cloud</TableHead>
                <TableHead className="text-xs uppercase text-gray-500 font-semibold tracking-wider">Action</TableHead>
                <TableHead className="text-xs uppercase text-gray-500 font-semibold tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400 space-y-3">
                    <Activity size={32} />
                    <p className="text-sm font-medium">No recent activity to display.</p>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
