import { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { taskAssignmentsApi } from "../../services/api/taskAssignments";
import { getAdminUsers } from "../../services/api/admin";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import type { CreateAssignmentPayload } from "../../types/assignment";

export interface ConfirmAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignUserId: string;
  payload: CreateAssignmentPayload;
}

export function ConfirmAssignmentModal({
  isOpen, onClose, assignUserId, payload
}: ConfirmAssignmentModalProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [previewData, setPreviewData] = useState<{ resource_count: number; is_valid: boolean; conflict: boolean; message: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [assigneeName, setAssigneeName] = useState<string>("Loading...");

  useEffect(() => {
    if (isOpen) {
      handlePreview();
      fetchUserName();
    } else {
      setPreviewData(null);
      setErrorMsg(null);
    }
  }, [isOpen, payload]);

  const fetchUserName = async () => {
    const token = await getToken();
    if (token && assignUserId) {
      try {
        const data = await getAdminUsers(token, 1, 100);
        const found = data.items?.find((u: any) => u.id === parseInt(assignUserId));
        if (found) {
          setAssigneeName(found.name);
        } else {
          setAssigneeName(`User ${assignUserId}`);
        }
      } catch (e) {
        setAssigneeName(`User ${assignUserId}`);
      }
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setErrorMsg(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await taskAssignmentsApi.previewTaskAssignment(token, payload);
      setPreviewData(res);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Preview failed.");
      setPreviewData(null);
    } finally {
      setPreviewing(false);
    }
  };

  const handleCreate = async () => {
    setAssigning(true);
    setErrorMsg(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await taskAssignmentsApi.createTaskAssignment(token, payload);
      navigate("/admin/user-tasks/assigned");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to create assignment.");
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Assign Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-md border border-gray-100 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Assign to:</span>
              <span className="font-semibold text-gray-900">{assigneeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Provider:</span>
              <span className="font-semibold text-gray-900">{payload.provider}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Scope Type:</span>
              <span className="font-semibold text-gray-900">{payload.scope_type.replace(/_/g, ' ')}</span>
            </div>
          </div>

          {previewing ? (
            <div className="text-center py-4 text-gray-500">Resolving resources...</div>
          ) : errorMsg ? (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
              {errorMsg}
            </div>
          ) : previewData ? (
            <div className={`p-4 rounded-md border text-sm ${previewData.is_valid ? 'bg-green-50/50 border-green-200 text-green-800' : 'bg-red-50/50 border-red-200 text-red-800'}`}>
              <div className="flex items-start gap-2">
                {previewData.is_valid ? <CheckCircle size={16} className="mt-0.5 text-green-600 flex-shrink-0" /> : <AlertCircle size={16} className="mt-0.5 text-red-600 flex-shrink-0" />}
                <div>
                  <p className="font-semibold">{previewData.resource_count} resources found.</p>
                  <p className="mt-1 opacity-90">{previewData.message}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={assigning} className="bg-white">
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={assigning || !previewData?.is_valid}
            className={`${payload.provider === 'AWS' ? 'bg-aws hover:bg-aws-dark' : 'bg-azure hover:bg-azure-dark'} text-white`}
          >
            {assigning ? "Creating..." : "Assign Task"}
          </Button>
        </div>
      </div>
    </div>
  );
}
