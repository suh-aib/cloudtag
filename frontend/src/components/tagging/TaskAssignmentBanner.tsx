import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { UserPlus, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { getAdminUsers } from "../../services/api/admin";

export function TaskAssignmentBanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, getToken } = useAuth();
  
  const assignUserId = searchParams.get("assign_user_id");
  const [assigneeName, setAssigneeName] = useState<string | null>(null);

  useEffect(() => {
    if (assignUserId && user?.role === "ADMIN") {
      const fetchUser = async () => {
        const token = await getToken();
        if (token) {
          try {
            const data = await getAdminUsers(token, 1, 100);
            const found = data.items?.find((u: any) => u.id === parseInt(assignUserId));
            if (found) {
              setAssigneeName(found.name);
            } else {
              setAssigneeName("Unknown User");
            }
          } catch (e) {
            setAssigneeName("Unknown User");
          }
        }
      };
      fetchUser();
    }
  }, [assignUserId, user, getToken]);

  if (!assignUserId || user?.role !== "ADMIN") return null;

  const handleExit = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("assign_user_id");
    navigate({ pathname: location.pathname, search: newParams.toString() });
  };

  return (
    <div className="bg-azure-light/30 border-l-4 border-azure p-4 rounded-r-md mb-6 flex justify-between items-center shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-azure text-white p-1.5 rounded-full">
          <UserPlus size={16} />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 text-sm">Task Assignment Mode</h4>
          <p className="text-sm text-gray-600">
            Assigning tasks to: <span className="font-bold text-gray-900">{assigneeName || "Loading..."}</span>
          </p>
        </div>
      </div>
      <button 
        onClick={handleExit}
        className="text-sm font-medium text-azure hover:text-azure-dark flex items-center gap-1 bg-white border border-azure-200 px-3 py-1.5 rounded-md shadow-sm transition-colors"
      >
        <X size={14} /> Exit Assignment Mode
      </button>
    </div>
  );
}
