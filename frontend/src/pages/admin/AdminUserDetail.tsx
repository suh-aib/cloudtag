import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Activity, ChevronRight } from "lucide-react";
import { taskAssignmentsApi } from "../../services/api/taskAssignments";
import type { TaskAssignment } from "../../types/assignment";
import { useAuth } from "../../contexts/AuthContext";

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [userName, setUserName] = useState("User");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        if (userId) {
          const token = await getToken();
          if (token) {
            const uId = parseInt(userId, 10);
            const data = await taskAssignmentsApi.getAdminUserProgressDetail(token, uId);
            setDetail(data);
            setTasks(data.tasks || []);
            setUserName(data.user_name);
          }
        }
      } catch (err) {
        console.error("Failed to load admin user detail", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [userId]);

  if (loading || !detail) return <div className="p-8">Loading user details...</div>;

  const totalAssignedResources = detail.total_assigned_resources || 0;
  const totalCompletedResources = detail.completed || 0;
  const totalPendingResources = detail.pending || 0;
  const overallProgress = detail.progress || 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to="/admin/user-tag-progress" className="hover:text-azure transition-colors">User Tag Progress</Link>
        <ChevronLeft size={14} />
        <span className="text-gray-900 font-medium">{userName}</span>
      </div>

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{userName}</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1 w-full">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Overall Assigned Work</h2>
          <div className="flex items-end justify-between mb-2">
            <span className="text-3xl font-bold text-gray-900">
              {totalCompletedResources} <span className="text-xl text-gray-400 font-normal">/ {totalAssignedResources} Resources Completed</span>
            </span>
            <span className="text-xl font-bold text-azure">{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
            <div className="bg-azure h-3 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }}></div>
          </div>
          <p className="text-sm text-gray-500 font-medium">{totalPendingResources} Pending</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
          <Activity size={20} className="text-azure" />
          <h3 className="font-bold text-gray-900">Tasks</h3>
        </div>
        
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No active tasks for this user.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">SL</th>
                  <th className="px-6 py-3">Task</th>
                  <th className="px-6 py-3">Assignment</th>
                  <th className="px-6 py-3">Resources</th>
                  <th className="px-6 py-3">Progress</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((t, i) => {
                  const comp = t.completed_resources || 0;
                  const total = t.resource_count || 0;
                  const pct = total > 0 ? Math.round((comp / total) * 100) : 0;
                  
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/admin/user-tag-progress/${userId}/task/${t.provider.toLowerCase()}/${t.id}`)}>
                      <td className="px-6 py-4 text-gray-500">{i + 1}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{t.task_number}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {t.provider} / {t.scope_type.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{comp} / {total}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-azure font-bold w-10">{pct}%</span>
                          <div className="w-24 bg-gray-100 rounded-full h-2">
                            <div className="bg-azure h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-azure hover:text-azure-dark font-medium text-sm flex items-center">
                          View <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
