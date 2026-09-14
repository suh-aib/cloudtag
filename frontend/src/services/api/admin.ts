import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const getAdminUsers = async (
  token: string, 
  page = 1, 
  size = 20, 
  search?: string, 
  role?: string, 
  status?: string
) => {
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("size", size.toString());
  if (search) params.append("search", search);
  if (role) params.append("role", role);
  if (status) params.append("status", status);

  const response = await axios.get(`${API_BASE_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return response.data;
};

export const updateUserRole = async (token: string, userId: number, role: string) => {
  const response = await axios.patch(
    `${API_BASE_URL}/api/admin/users/${userId}/role`,
    { role },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const updateUserStatus = async (token: string, userId: number, status: string) => {
  const response = await axios.patch(
    `${API_BASE_URL}/api/admin/users/${userId}/status`,
    { status },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};
