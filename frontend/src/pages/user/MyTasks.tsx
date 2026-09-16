import { useState, useEffect } from "react";
import { Cloud, Server, ChevronRight, Activity } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { taskAssignmentsApi } from "../../services/api/taskAssignments";
import type { TaskAssignment } from "../../types/assignment";

export default function MyTasks() {
  const { user, getToken } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const data = await taskAssignmentsApi.getMyTasks(token);
          setTasks(data);
        }
      } catch (err) {
        console.error("Failed to load tasks", err);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) {
      fetchTasks();
    }
  }, [user]);

  if (loading) return <div className="p-8">Loading tasks...</div>;

  const azureTasks = tasks.filter(t => t.provider === "AZURE");
  const awsTasks = tasks.filter(t => t.provider === "AWS");

  const azureResources = azureTasks.reduce((acc, t) => acc + (t.resource_count || 0), 0);
  const awsResources = awsTasks.reduce((acc, t) => acc + (t.resource_count || 0), 0);

  const TaskTable = ({ providerTasks, provider }: { providerTasks: TaskAssignment[], provider: string }) => {
    if (providerTasks.length === 0) {
      return (
        <div className="p-8 text-center border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <p className="text-gray-500 text-sm">No active {provider} tasks.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium border-y border-gray-200">
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
            {providerTasks.map((t, i) => (
              <tr key={t.id} className="hover:bg-gray-50/50">
                <td className="px-6 py-4 text-gray-500">{i + 1}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{t.task_number}</td>
                <td className="px-6 py-4 text-gray-600">
                  {t.provider} / {t.scope_type.replace('_', ' ')}
                </td>
                <td className="px-6 py-4 text-gray-900 font-medium">{t.resource_count}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 font-medium">{t.completed_resources || 0} / {t.resource_count}</span>
                    <span className="text-gray-400 text-xs">({t.resource_count > 0 ? Math.round(((t.completed_resources || 0) / t.resource_count) * 100) : 0}%)</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {t.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => navigate(`/my-tasks/${t.provider.toLowerCase()}/${t.id}`)}
                    className="text-azure hover:text-azure-dark font-medium text-sm flex items-center"
                  >
                    View Task <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Tasks</h1>
          <p className="text-gray-500">Review and complete your assigned tagging tasks.</p>
        </div>
        <Link to="/my-tagging-progress" className="flex items-center gap-2 text-sm text-azure hover:text-azure-dark font-medium bg-azure/5 px-4 py-2 rounded-lg transition-colors">
          <Activity size={16} />
          View Overall Progress
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start gap-4">
          <div className="w-12 h-12 bg-azure/10 text-azure rounded-xl flex items-center justify-center shrink-0">
            <Cloud size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Azure</h2>
            <div className="mt-2 flex gap-4 text-sm">
              <div className="flex flex-col">
                <span className="text-gray-500">Active Tasks</span>
                <span className="font-bold text-gray-900 text-lg">{azureTasks.length}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500">Resources</span>
                <span className="font-bold text-gray-900 text-lg">{azureResources}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start gap-4">
          <div className="w-12 h-12 bg-aws/10 text-aws rounded-xl flex items-center justify-center shrink-0">
            <Server size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">AWS</h2>
            <div className="mt-2 flex gap-4 text-sm">
              <div className="flex flex-col">
                <span className="text-gray-500">Active Tasks</span>
                <span className="font-bold text-gray-900 text-lg">{awsTasks.length}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500">Resources</span>
                <span className="font-bold text-gray-900 text-lg">{awsResources}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Cloud size={20} className="text-azure" />
          <h3 className="font-bold text-gray-900">Azure Tasks</h3>
        </div>
        <TaskTable providerTasks={azureTasks} provider="Azure" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Server size={20} className="text-aws" />
          <h3 className="font-bold text-gray-900">AWS Tasks</h3>
        </div>
        <TaskTable providerTasks={awsTasks} provider="AWS" />
      </div>
    </div>
  );
}
