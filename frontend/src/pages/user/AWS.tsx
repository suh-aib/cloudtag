import { Server, Search, Filter } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getProviderAccounts, type InventoryAccount } from "../../services/api/inventory";

export default function AWS() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<InventoryAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getToken().then(token => {
      if (token) {
        getProviderAccounts(token, 'aws')
          .then(data => {
            setAccounts(data);
          })
          .catch(console.error)
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });
  }, [getToken]);
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">AWS Accounts</h1>
          <p className="text-sm text-gray-500">Select an account to explore regions and resources.</p>
        </div>
        <Card className="shadow-sm border-gray-200 min-w-[120px]">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center bg-gray-50/50">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Accounts</span>
            <span className="text-2xl font-bold text-gray-900">{accounts.length}</span>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-gray-200">
        <div className="p-4 border-b border-gray-200 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search accounts..."
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
                <TableHead className="font-semibold text-gray-700">Account Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Account ID</TableHead>
                <TableHead className="font-semibold text-gray-700 text-center">Regions</TableHead>
                <TableHead className="font-semibold text-gray-700 text-center">Resources</TableHead>
                <TableHead className="w-48 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center text-gray-500">
                    Loading accounts...
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400 space-y-3">
                      <Server size={48} className="text-aws/40" />
                      <p className="text-sm font-medium text-gray-600">No AWS accounts available</p>
                      <p className="text-xs text-gray-400">Import resource inventory from Data Sources to begin.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map(acc => (
                  <TableRow key={acc.account_identifier} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium text-gray-900">{acc.account_name}</TableCell>
                    <TableCell className="text-gray-500 font-mono text-xs">{acc.account_identifier}</TableCell>
                    <TableCell className="text-center">{acc.group_count}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-aws-light text-aws">
                        {acc.resource_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" className="h-8 border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => navigate(`/bulk-tagging/wizard?provider=AWS&scopeType=AWS_ACCOUNT&accountId=${encodeURIComponent(acc.account_identifier)}`)}>
                        Bulk Tag
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-aws hover:bg-aws-light" asChild>
                        <Link to={`/aws/${encodeURIComponent(acc.account_identifier)}`}>
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
