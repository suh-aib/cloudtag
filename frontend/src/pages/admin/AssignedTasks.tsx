import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search, Filter } from "lucide-react";
import { taskAssignmentsApi } from "../../services/api/taskAssignments";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";

export default function AssignedTasks() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const data = await taskAssignmentsApi.getAllTasks(token);
        setTasks(data);
      }
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(t => 
    t.task_number.toLowerCase().includes(search.toLowerCase()) ||
    t.provider.toLowerCase().includes(search.toLowerCase()) ||
    t.scope_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Assigned Tasks</h1>
          <p className="text-gray-500">View and manage all active and historical tagging assignments.</p>
        </div>
        <Button onClick={() => navigate("/admin/user-tasks/assign")} className="bg-azure hover:bg-azure-dark text-white">
          Assign New Task
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks, providers, scopes..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-azure focus:border-azure"
              />
            </div>
            <Button variant="outline" className="text-gray-600 bg-white">
              <Filter size={16} className="mr-2" /> Filter
            </Button>
          </div>
          <span className="text-sm font-medium text-gray-500">{filteredTasks.length} Tasks</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading assignments...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No assignments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Task</th>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Provider</th>
                  <th className="px-6 py-3">Assignment Scope</th>
                  <th className="px-6 py-3 text-center">Resources</th>
                  <th className="px-6 py-3 text-center">Progress</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/admin/user-tasks/progress/${t.assigned_user_id}/task/${t.provider.toLowerCase()}/${t.id}`)}>
                    <td className="px-6 py-4 font-bold text-azure">{t.task_number}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{t.assigned_user_name || `User ${t.assigned_user_id}`}</td>
                    <td className="px-6 py-4">
                      <Badge variant={t.provider === "AZURE" ? "info" : "warning"}>{t.provider}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 text-xs">{t.scope_type}</span>
                        <span className="text-gray-500 text-xs truncate max-w-[200px]">
                          {t.resource_type || t.resource_group || t.region_id || t.subscription_id || t.account_id || "Selected Resources"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-gray-900">{t.resource_count}</td>
                    <td className="px-6 py-4 text-center text-gray-500">0%</td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="success">{t.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-azure hover:text-azure-dark font-medium text-sm inline-flex items-center">
                        View <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
