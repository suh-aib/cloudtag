import { Cloud, ChevronRight, Folder } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { InventoryFilters } from "../../components/ui/InventoryFilters";
import type { InventoryFilters as APIFilters } from "../../services/api/inventory";
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getAWSRegions, getProviderAccounts, type ResourceGroupCount } from "../../services/api/inventory";
import { TaskAssignmentBanner } from "../../components/tagging/TaskAssignmentBanner";
import { ConfirmAssignmentModal } from "../../components/tagging/ConfirmAssignmentModal";
import type { CreateAssignmentPayload } from "../../types/assignment";


const AWS_REGION_NAMES: Record<string, string> = {
  "us-east-1": "US East (N. Virginia)",
  "us-east-2": "US East (Ohio)",
  "us-west-1": "US West (N. California)",
  "us-west-2": "US West (Oregon)",
  "af-south-1": "Africa (Cape Town)",
  "ap-east-1": "Asia Pacific (Hong Kong)",
  "ap-south-1": "Asia Pacific (Mumbai)",
  "ap-northeast-2": "Asia Pacific (Seoul)",
  "ap-southeast-1": "Asia Pacific (Singapore)",
  "ap-southeast-2": "Asia Pacific (Sydney)",
  "ap-northeast-1": "Asia Pacific (Tokyo)",
  "ca-central-1": "Canada (Central)",
  "eu-central-1": "Europe (Frankfurt)",
  "eu-west-1": "Europe (Ireland)",
  "eu-west-2": "Europe (London)",
  "eu-south-1": "Europe (Milan)",
  "eu-west-3": "Europe (Paris)",
  "eu-north-1": "Europe (Stockholm)",
  "me-south-1": "Middle East (Bahrain)",
  "sa-east-1": "South America (São Paulo)"
};

const getRegionDisplayName = (region: string) => {
  return AWS_REGION_NAMES[region] ? `${AWS_REGION_NAMES[region]} (${region})` : region;
};

export default function AWSRegions() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignUserId = searchParams.get("assign_user_id");
  const taskId = searchParams.get("task_id");

  const { getToken, user } = useAuth();
  const [regions, setRegions] = useState<ResourceGroupCount[]>([]);
  const [accountName, setAccountName] = useState<string>(accountId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<APIFilters>({ ...(taskId ? { task_id: parseInt(taskId, 10) } : {}) });

  const [assignPayload, setAssignPayload] = useState<CreateAssignmentPayload | null>(null);

  const getQueryString = () => {
    const p = new URLSearchParams();
    if (assignUserId) p.append("assign_user_id", assignUserId);
    if (taskId) p.append("task_id", taskId);
    const s = p.toString();
    return s ? `?${s}` : "";
  };


  useEffect(() => {
    if (!accountId) return;
    setIsLoading(true);
    getToken().then(token => {
      if (token) {

        Promise.all([
          getAWSRegions(token, accountId, filters),
          getProviderAccounts(token, 'aws', filters)
        ])
          .then(([regionsData, accountsData]) => {
            setRegions(regionsData);
            const acc = accountsData.find(a => a.account_identifier === accountId);
            if (acc && acc.account_name) {
              setAccountName(acc.account_name);
            }
          })
          .catch(console.error)
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });
  }, [getToken, accountId, filters]);

  const totalResources = regions.reduce((acc, curr) => acc + curr.resource_count, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <TaskAssignmentBanner />
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to={`/aws${getQueryString()}`} className="hover:text-aws transition-colors flex items-center gap-1">
          <Cloud size={14} />
          AWS
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-gray-900">{accountName}</span>
      </div>

      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Regions</h1>
          <p className="text-sm text-gray-500">Select a region to explore its resources.</p>
        </div>
        <div className="flex gap-4">
          <Card className="shadow-sm border-gray-200 min-w-[120px]">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center bg-gray-50/50">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Regions</span>
              <span className="text-2xl font-bold text-gray-900">{regions.length}</span>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-gray-200 min-w-[120px]">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center bg-gray-50/50">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Resources</span>
              <span className="text-2xl font-bold text-gray-900">{totalResources}</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <InventoryFilters 
            onFiltersChange={setFilters} 
            showLocationFilter={false}
            showResourceTypeFilter={false}
          />
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-semibold text-gray-700">Region</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Resource Types</TableHead>
                <TableHead className="font-semibold text-gray-700 text-center">Resources</TableHead>
                <TableHead className="w-48 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center text-gray-500">
                    Loading regions...
                  </TableCell>
                </TableRow>
              ) : regions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400 space-y-3">
                      <Folder size={48} className="text-aws/40" />
                      <p className="text-sm font-medium text-gray-600">No regions available</p>
                      <p className="text-xs text-gray-400">Import resource inventory to see data here.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                regions.map(regionObj => (
                  <TableRow key={regionObj.name} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium text-gray-900">{getRegionDisplayName(regionObj.name)}</TableCell>
                    <TableCell className="text-center">{regionObj.types_count}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-aws-light text-aws">
                        {regionObj.resource_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {user?.role === "ADMIN" && assignUserId && (
                        <Button variant="outline" size="sm" className="h-8 border-aws-200 text-aws hover:bg-aws-50" onClick={() => setAssignPayload({
                          provider: "AWS",
                          scope_type: "REGION",
                          account_id: accountId || '',
                          region_id: regionObj.name,
                          assigned_user_id: parseInt(assignUserId)
                        })}>
                          Assign Task
                        </Button>
                      )}
                      {!assignUserId && (
                        <Button variant="outline" size="sm" className="h-8 border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => navigate(`/bulk-tagging/wizard?provider=AWS&scopeType=REGION&accountId=${encodeURIComponent(accountId || '')}&region=${encodeURIComponent(regionObj.name)}${taskId ? `&task_id=${taskId}` : ''}`)}>
                          Bulk Tag
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 text-aws hover:bg-aws-light" asChild>
                        <Link to={`/aws/${encodeURIComponent(accountId || '')}/${encodeURIComponent(regionObj.name)}${getQueryString()}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {assignPayload && assignUserId && (
        <ConfirmAssignmentModal
          isOpen={!!assignPayload}
          onClose={() => setAssignPayload(null)}
          assignUserId={assignUserId}
          payload={assignPayload}
        />
      )}
    </div>
  );
}
