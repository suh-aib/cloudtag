import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getAdminUsers, updateUserRole, updateUserStatus } from "../../services/api/admin";
import { Search, Edit2, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";

export default function UsersRoles() {
  const { getToken, user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const data = await getAdminUsers(token, page, 20, search, roleFilter, statusFilter);
      setUsers(data.items);
      setTotalPages(data.pages);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const openModal = (user: any) => {
    setSelectedUser(user);
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleRoleChange = async (newRole: string) => {
    if (!selectedUser) return;
    try {
      setActionError(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const updated = await updateUserRole(token, selectedUser.id, newRole);
      setSelectedUser(updated);
      setUsers(users.map(u => u.id === updated.id ? updated : u));
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to update role");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedUser) return;
    try {
      setActionError(null);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const updated = await updateUserStatus(token, selectedUser.id, newStatus);
      setSelectedUser(updated);
      setUsers(users.map(u => u.id === updated.id ? updated : u));
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to update status");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Users & Roles</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center gap-2 border border-red-200 shadow-sm">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <Card className="shadow-sm border-gray-200">
        <CardHeader className="flex flex-row flex-wrap gap-4 items-center justify-between space-y-0">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </form>

          <div className="flex gap-4">
            <select 
              value={roleFilter} 
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>

            <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <Spinner className="h-8 w-8 mx-auto text-gray-400" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-gray-500">
                    No users found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium text-gray-900">{user.display_name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'ADMIN' ? "info" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'ACTIVE' ? "success" : "destructive"}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => openModal(user)}
                      >
                        <Edit2 size={16} /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="p-4 border-t flex justify-between items-center bg-gray-50 text-sm rounded-b-lg">
              <div className="text-gray-600">
                Showing page <span className="font-medium text-gray-900">{page}</span> of <span className="font-medium text-gray-900">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogHeader onClose={() => setIsModalOpen(false)}>
          <DialogTitle>User Management</DialogTitle>
        </DialogHeader>
        
        <DialogContent className="space-y-6 max-w-6xl mx-auto py-2">
          {actionError && (
            <div className="p-3 bg-red-50 text-red-700 rounded text-sm border border-red-200">
              {actionError}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500 font-medium">Name</div>
              <div className="text-gray-900">{selectedUser?.display_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 font-medium">Email</div>
              <div className="text-gray-900">{selectedUser?.email}</div>
            </div>
            
            <div className="border-t pt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Application Role</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleRoleChange('USER')}
                  disabled={selectedUser?.id === currentUser?.id}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                    selectedUser?.role === 'USER' 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'bg-white hover:bg-gray-50 disabled:opacity-50'
                  }`}
                >
                  USER
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to grant ADMIN privileges to this user?")) {
                      handleRoleChange('ADMIN');
                    }
                  }}
                  disabled={selectedUser?.id === currentUser?.id}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                    selectedUser?.role === 'ADMIN' 
                    ? 'bg-purple-50 border-purple-200 text-purple-700' 
                    : 'bg-white hover:bg-gray-50 disabled:opacity-50'
                  }`}
                >
                  ADMIN
                </button>
              </div>
              {selectedUser?.id === currentUser?.id && (
                <p className="text-xs text-orange-600 mt-2">You cannot modify your own role.</p>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Account Status</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleStatusChange('ACTIVE')}
                  disabled={selectedUser?.id === currentUser?.id}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                    selectedUser?.status === 'ACTIVE' 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-white hover:bg-gray-50 disabled:opacity-50'
                  }`}
                >
                  ACTIVE
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to disable this user's access to CloudTag?")) {
                      handleStatusChange('DISABLED');
                    }
                  }}
                  disabled={selectedUser?.id === currentUser?.id}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                    selectedUser?.status === 'DISABLED' 
                    ? 'bg-red-50 border-red-200 text-red-700' 
                    : 'bg-white hover:bg-gray-50 disabled:opacity-50'
                  }`}
                >
                  DISABLED
                </button>
              </div>
              {selectedUser?.id === currentUser?.id && (
                <p className="text-xs text-orange-600 mt-2">You cannot modify your own status.</p>
              )}
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsModalOpen(false)}>Done</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
