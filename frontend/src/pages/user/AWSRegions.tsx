import { Cloud, Search, Filter, ChevronRight, Folder } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getAWSRegions, getProviderAccounts, type ResourceGroupCount } from "../../services/api/inventory";

export default function AWSRegions() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [regions, setRegions] = useState<ResourceGroupCount[]>([]);
  const [accountName, setAccountName] = useState<string>(accountId || '');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    setIsLoading(true);
    getToken().then(token => {
      if (token) {

        Promise.all([
          getAWSRegions(token, accountId),
          getProviderAccounts(token, 'aws')
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
  }, [getToken, accountId]);

  const totalResources = regions.reduce((acc, curr) => acc + curr.resource_count, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to="/aws" className="hover:text-aws transition-colors flex items-center gap-1">
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
        <div className="p-4 border-b border-gray-200 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search regions..."
              className="pl-10 bg-gray-50/50"
            />
          </div>
          <Button variant="outline" className="gap-2 text-gray-600">
            <Filter size={16} /> Filter
          </Button>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-semibold text-gray-700">Region</TableHead>
                <TableHead className="font-semibold text-gray-700">Region(s)</TableHead>
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
                    <TableCell className="font-medium text-gray-900">{regionObj.name}</TableCell>
                    <TableCell className="text-gray-500 text-xs">{regionObj.locations.join(', ') || 'N/A'}</TableCell>
                    <TableCell className="text-center">{regionObj.types_count}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-aws-light text-aws">
                        {regionObj.resource_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" className="h-8 border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => navigate(`/bulk-tagging/wizard?provider=AZURE&scopeType=RESOURCE_GROUP&accountId=${encodeURIComponent(accountId || '')}&resourceGroup=${encodeURIComponent(regionObj.name)}`)}>
                        Bulk Tag
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-aws hover:bg-aws-light" asChild>
                        <Link to={`/aws/${encodeURIComponent(accountId || '')}/${encodeURIComponent(regionObj.name)}`}>
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
    </div>
  );
}
