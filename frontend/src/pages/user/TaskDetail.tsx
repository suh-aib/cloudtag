import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Cloud, Server, Clock, CheckCircle, Tag } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { taskAssignmentsApi } from "../../services/api/taskAssignments";
import { useAuth } from "../../contexts/AuthContext";

interface TaskDetailProps {
  adminMode?: boolean;
}

export default function TaskDetail({ adminMode = false }: TaskDetailProps) {
  const { taskId, userId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        setLoading(true);
        if (taskId) {
          const token = await getToken();
          if (token) {
            const data = adminMode 
              ? await taskAssignmentsApi.getAdminTaskDetail(token, taskId)
              : await taskAssignmentsApi.getMyTaskDetail(token, taskId);
            setTask(data.task);
          }
        }
      } catch (err) {
        console.error("Failed to load task", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [taskId, adminMode]);

  if (loading) {
    return <div className="p-8">Loading task...</div>;
  }

  const isAzure = task.provider === "AZURE";

  const compProgress = task.resource_count ? Math.round(((task.completed_resources || 0) / task.resource_count) * 100) : 0;

  const handleContinue = () => {
    let url = "";
    if (task.provider === "AZURE") {
      if (task.scope_type === "SUBSCRIPTION" || task.scope_type === "ACCOUNT") {
        url = `/azure/${task.subscription_id || task.account_id}`;
      } else if (task.scope_type === "RESOURCE_GROUP") {
        url = `/azure/${task.subscription_id || task.account_id}/${task.resource_group}`;
      } else if (task.scope_type === "RESOURCE_TYPE") {
        url = `/azure/${task.subscription_id || task.account_id}/${task.resource_group}/${encodeURIComponent(task.resource_type)}`;
      } else {
        url = `/azure`;
      }
    } else if (task.provider === "AWS") {
      if (task.scope_type === "ACCOUNT") {
        url = `/aws/${task.account_id}`;
      } else if (task.scope_type === "REGION") {
        url = `/aws/${task.account_id}/${task.region_id || task.region}`;
      } else if (task.scope_type === "RESOURCE_TYPE") {
        url = `/aws/${task.account_id}/${task.region_id || task.region}/${encodeURIComponent(task.resource_type)}`;
      } else {
        url = `/aws`;
      }
    } else {
      url = "/";
    }
    
    const char = url.includes("?") ? "&" : "?";
    navigate(`${url}${char}task_id=${task.id}`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        {adminMode ? (
          <>
            <Link to="/admin/user-tag-progress" className="hover:text-azure transition-colors">User Tag Progress</Link>
            <ChevronLeft size={14} />
            <Link to={`/admin/user-tag-progress/${userId || task.assigned_user_id}`} className="hover:text-azure transition-colors">
              User
            </Link>
            <ChevronLeft size={14} />
            <span className="text-gray-900 font-medium">Task {task.task_number}</span>
          </>
        ) : (
          <>
            <Link to="/my-tasks" className="hover:text-azure transition-colors">My Tasks</Link>
            <ChevronLeft size={14} />
            <span className="text-gray-900 font-medium">Task {task.task_number}</span>
          </>
        )}
      </div>

      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isAzure ? 'bg-azure/10 text-azure' : 'bg-aws/10 text-aws'}`}>
            {isAzure ? <Cloud size={24} /> : <Server size={24} />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              {task.task_number}
              {adminMode && (
                <span className="text-xs font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Admin View
                </span>
              )}
            </h1>
            <p className="text-gray-500 font-medium mt-1">
              {task.provider} / {task.scope_type.replace('_', ' ')}
            </p>
          </div>
        </div>
        
        {!adminMode && (
          <Button onClick={handleContinue} className="bg-azure hover:bg-azure-dark text-white flex items-center gap-2 shadow-sm">
            <Tag size={16} /> Continue to Tagging
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 col-span-1 md:col-span-3 grid grid-cols-3 divide-x divide-gray-100">
          <div className="px-4 first:pl-0 flex flex-col justify-center">
            <span className="text-gray-500 text-sm font-medium mb-1 flex items-center gap-1.5"><Clock size={14}/> Assigned Date</span>
            <span className="text-gray-900 font-medium">{new Date(task.created_at).toLocaleDateString()}</span>
          </div>
          <div className="px-4 flex flex-col justify-center">
            <span className="text-gray-500 text-sm font-medium mb-1 flex items-center gap-1.5">Assigned User</span>
            <span className="text-gray-900 font-medium">{task.assigned_user_name || task.assigned_user_id}</span>
          </div>
          <div className="px-4 last:pr-0 flex flex-col justify-center">
            <span className="text-gray-500 text-sm font-medium mb-1 flex items-center gap-1.5"><CheckCircle size={14}/> Status</span>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 self-start">
              {task.status}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-center">
           <span className="text-gray-500 text-sm font-medium mb-2">Resource Progress</span>
           <div className="flex items-end justify-between mb-2">
             <span className="text-2xl font-bold text-gray-900">{task.completed_resources || 0} <span className="text-lg text-gray-400 font-normal">/ {task.resource_count}</span></span>
             <span className="text-sm font-bold text-azure">{compProgress}%</span>
           </div>
           <div className="w-full bg-gray-100 rounded-full h-2.5">
             <div className="bg-azure h-2.5 rounded-full" style={{ width: `${compProgress}%` }}></div>
           </div>
        </div>
      </div>

      {/* Assigned Resources table removed to keep view lightweight as per requirement */}
    </div>
  );
}
