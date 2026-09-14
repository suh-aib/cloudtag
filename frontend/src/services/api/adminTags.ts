import axios from "axios";
import type { TagDefinition, TagValue } from "./tagging";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const getAdminTagDefinitions = async (token: string, provider?: string): Promise<TagDefinition[]> => {
  const params = provider ? { provider } : {};
  const response = await axios.get(`${API_BASE_URL}/api/admin/tags`, {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return response.data;
};

export const createAdminTagDefinition = async (
  token: string, 
  data: { provider: string; name: string; description?: string; mandatory: boolean; enabled: boolean }
): Promise<TagDefinition> => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/tags`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const updateAdminTagDefinition = async (
  token: string, 
  id: number, 
  data: { description?: string; mandatory?: boolean; enabled?: boolean }
): Promise<TagDefinition> => {
  const response = await axios.put(`${API_BASE_URL}/api/admin/tags/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const deleteAdminTagDefinition = async (token: string, id: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/admin/tags/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const createAdminTagValue = async (
  token: string, 
  tagId: number, 
  data: { value: string; display_name?: string; enabled: boolean }
): Promise<TagValue> => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/tags/${tagId}/values`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const createAdminTagValuesBulk = async (
  token: string,
  tagId: number,
  values: string[]
): Promise<TagValue[]> => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/tags/${tagId}/values/bulk`, { values }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const updateAdminTagValue = async (
  token: string, 
  valueId: number, 
  data: { value?: string; display_name?: string; enabled?: boolean }
): Promise<TagValue> => {
  const response = await axios.put(`${API_BASE_URL}/api/admin/tags/values/${valueId}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const deleteAdminTagValue = async (token: string, valueId: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/admin/tags/values/${valueId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
};
