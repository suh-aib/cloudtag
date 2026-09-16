import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ChevronRight } from "lucide-react";
import { taskAssignmentsApi } from "../../services/api/taskAssignments";
import { useAuth } from "../../contexts/AuthContext";

interface UserProgressInfo {
  user_id: number;
  user_name: string;
  task_count: number;
  total_resources: number;
  completed_resources: number;
  progress_percentage: number;
}

export default function UserTagProgress() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [usersProgress, setUsersProgress] = useState<UserProgressInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const data = await taskAssignmentsApi.getAdminUserTagProgress(token);
        setUsersProgress(data);
      }
    } catch (err) {
      console.error("Failed to load user tag progress", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Task Progress</h1>
          <p className="text-gray-500">Monitor assigned tagging workload and completion across all users.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2 text-gray-700">
            <Activity size={20} className="text-azure" />
            <h3 className="font-bold">Active Assignments</h3>
          </div>
          <span className="text-sm font-medium text-gray-500 bg-white px-2.5 py-1 rounded-md border border-gray-200 shadow-sm">{usersProgress.length} Users</span>
        </div>
        
        {usersProgress.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">No users currently have assigned tasks.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">SL</th>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Tasks</th>
                  <th className="px-6 py-3">Resources</th>
                  <th className="px-6 py-3">Completed</th>
                  <th className="px-6 py-3">Progress</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersProgress.map((u, i) => (
                  <tr key={u.user_id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/admin/user-tasks/progress/${u.user_id}`)}>
                    <td className="px-6 py-4 text-gray-500">{i + 1}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{u.user_name}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{u.task_count}</td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{u.completed_resources} / {u.total_resources}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{u.completed_resources}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-azure font-bold w-10">{u.progress_percentage}%</span>
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div className="bg-azure h-2 rounded-full" style={{ width: `${u.progress_percentage}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-azure hover:text-azure-dark font-medium text-sm flex items-center">
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
