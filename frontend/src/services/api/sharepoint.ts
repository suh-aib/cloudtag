import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const getSharePointConfig = async (token: string, provider: "azure" | "aws") => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/sharepoint/${provider}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const updateSharePointConfig = async (token: string, provider: "azure" | "aws", data: any) => {
  const response = await axios.put(`${API_BASE_URL}/api/admin/sharepoint/${provider}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const testSharePointConnection = async (token: string, provider: "azure" | "aws") => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/sharepoint/${provider}/test-connection`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getSharePointMappings = async (token: string, provider: "azure" | "aws") => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/sharepoint/${provider}/mapping`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const detectSharePointMappings = async (token: string, provider: "azure" | "aws") => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/sharepoint/${provider}/mapping/detect`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const updateSharePointMapping = async (token: string, provider: "azure" | "aws", mappingId: number, data: any) => {
  const response = await axios.patch(`${API_BASE_URL}/api/admin/sharepoint/${provider}/mapping/${mappingId}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const syncSharePoint = async (token: string, provider: "azure" | "aws") => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/sharepoint/${provider}/sync`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
