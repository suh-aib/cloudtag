import { useEffect, useState } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { Info, X } from "lucide-react";
import { taskAssignmentsApi } from "../../services/api/taskAssignments";
import { useAuth } from "../../contexts/AuthContext";

export function TaskContextBanner() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken, user } = useAuth();
  
  const taskId = searchParams.get("task_id");
  const [taskName, setTaskName] = useState<string>("");

  useEffect(() => {
    if (taskId) {
      getToken().then(token => {
        if (token) {
          if (user?.role === "ADMIN") {
              taskAssignmentsApi.getAdminTaskDetail(token, taskId).then(res => {
                setTaskName(res.task.task_number);
              }).catch(() => {
                setTaskName(`ID: ${taskId}`);
              });
          } else {
              taskAssignmentsApi.getMyTaskDetail(token, taskId).then(res => {
                setTaskName(res.task.task_number);
              }).catch(() => {
                setTaskName(`ID: ${taskId}`);
              });
          }
        }
      });
    } else {
      setTaskName("");
    }
  }, [taskId, getToken, user]);

  if (!taskId) return null;

  const handleExit = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("task_id");
    navigate(`${location.pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-azure/10 border-b border-azure/20 px-6 py-2.5 flex items-center justify-between text-azure-dark shadow-sm">
      <div className="flex items-center gap-2">
        <Info size={16} className="text-azure" />
        <span className="text-sm font-medium">
          You are currently viewing resources for <strong>Task {taskName || "..."}</strong>.
        </span>
      </div>
      <button 
        onClick={handleExit}
        className="text-xs font-medium bg-white/50 hover:bg-white border border-azure/20 px-3 py-1 rounded-md transition-colors flex items-center gap-1.5"
      >
        <X size={14} /> Exit Task View
      </button>
    </div>
  );
}
