import axios from "axios";
import type { TaskAssignment, CreateAssignmentPayload } from "../../types/assignment";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

export const taskAssignmentsApi = {
  // --- Admin Endpoints ---
  
  createTaskAssignment: async (token: string, payload: CreateAssignmentPayload): Promise<TaskAssignment> => {
    const response = await api.post<TaskAssignment>("/admin/task-assignments", payload, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  previewTaskAssignment: async (token: string, payload: CreateAssignmentPayload): Promise<{ resource_count: number; is_valid: boolean; conflict: boolean; message: string }> => {
    const response = await api.post("/admin/task-assignments/preview", payload, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getAllTasks: async (token: string, userId?: number): Promise<TaskAssignment[]> => {
    const params = userId ? { user_id: userId } : {};
    const response = await api.get<TaskAssignment[]>("/admin/task-assignments", { params, headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getAdminUserTagProgress: async (token: string): Promise<any[]> => {
    const response = await api.get<any[]>("/admin/user-tag-progress", { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getAdminUserProgressDetail: async (token: string, userId: number): Promise<any> => {
    const response = await api.get<any>(`/admin/user-tag-progress/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },
  
  getAdminTaskDetail: async (token: string, taskId: string | number): Promise<any> => {
    const response = await api.get<any>(`/admin/task-assignments/${taskId}`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  // --- User Endpoints ---

  getMyTasks: async (token: string): Promise<TaskAssignment[]> => {
    const response = await api.get<TaskAssignment[]>("/my/tasks", { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMyTaskDetail: async (token: string, taskId: string | number): Promise<any> => {
    const response = await api.get<any>(`/my/tasks/${taskId}`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMyTaggingProgress: async (token: string): Promise<any> => {
    const response = await api.get<any>("/my/tagging-progress", { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  }
};
