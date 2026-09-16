import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, ArrowRight, Search, Cloud, Server } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { useAuth } from "../../contexts/AuthContext";
import { getAdminUsers } from "../../services/api/admin";

export default function AssignTask() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [provider, setProvider] = useState<"AZURE" | "AWS" | "">("");
  
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const token = await getToken();
      if (!token) return;
      const data = await getAdminUsers(token, 1, 100, "", "", "ACTIVE");
      setUsers(data.items || []);
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleContinue = () => {
    if (!selectedUser || !provider) return;
    
    if (provider === "AZURE") {
      navigate(`/azure?assign_user_id=${selectedUser.id}`);
    } else {
      navigate(`/aws?assign_user_id=${selectedUser.id}`);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.display_name || "").toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.email || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <UserPlus size={24} className="text-azure" /> Assign Task
        </h1>
        <p className="text-gray-500 text-sm">Select a user and cloud provider to begin assigning tasks.</p>
      </div>

      <div className="space-y-6">
        <Card className="flex flex-col h-full shadow-sm border-gray-200">
          <CardContent className="p-6 flex flex-col h-full">
            <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-4">Step 1: Select User</h3>
            
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text" 
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-azure focus:border-azure"
              />
            </div>

            <div className="flex-1 border rounded-md overflow-hidden bg-white max-h-60 overflow-y-auto min-h-[150px]">
              {loadingUsers ? (
                <div className="p-4 text-center text-sm text-gray-500">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">No matching users.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredUsers.map(u => (
                    <label 
                      key={u.id} 
                      className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedUser?.id === u.id ? 'bg-azure/5 border-l-2 border-azure' : ''}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{u.display_name || 'Unknown User'}</span>
                        <span className="text-xs text-gray-500">{u.email}</span>
                      </div>
                      <input 
                        type="radio" 
                        name="assignee" 
                        value={u.id} 
                        checked={selectedUser?.id === u.id}
                        onChange={() => setSelectedUser(u)}
                        className="h-4 w-4 text-azure border-gray-300 focus:ring-azure"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedUser && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 shadow-sm border-gray-200">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Step 2: Select Cloud Provider</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  className={`flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all ${provider === 'AZURE' ? 'border-azure bg-azure/5 shadow-sm' : 'border-gray-200 hover:border-azure/30 hover:bg-gray-50'}`}
                  onClick={() => setProvider('AZURE')}
                >
                  <Cloud className={provider === 'AZURE' ? 'text-azure mb-2' : 'text-gray-400 mb-2'} size={32} />
                  <div className="font-semibold text-gray-900">Azure</div>
                </button>
                <button 
                  className={`flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all ${provider === 'AWS' ? 'border-aws bg-aws/5 shadow-sm' : 'border-gray-200 hover:border-aws/30 hover:bg-gray-50'}`}
                  onClick={() => setProvider('AWS')}
                >
                  <Server className={provider === 'AWS' ? 'text-aws mb-2' : 'text-gray-400 mb-2'} size={32} />
                  <div className="font-semibold text-gray-900">AWS</div>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end pt-2">
          <Button 
            onClick={handleContinue} 
            disabled={!provider || !selectedUser}
            className="bg-azure hover:bg-azure-dark text-white px-8"
          >
            Continue to Selection <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
