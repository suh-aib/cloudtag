import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const getCloudAccounts = async (token: string, provider?: string) => {
  const params = provider ? new URLSearchParams({ cloud: provider }) : undefined;
  const response = await axios.get(`${API_BASE_URL}/api/admin/cloud`, {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return response.data;
};

export const createCloudAccount = async (token: string, data: any) => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/cloud`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const updateCloudAccount = async (token: string, accountId: number, data: any) => {
  const response = await axios.patch(`${API_BASE_URL}/api/admin/cloud/${accountId}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const syncCloudRegions = async (token: string, accountId: number, regions: string[]) => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/cloud/${accountId}/regions`, { regions }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const testCloudConnection = async (token: string, accountId: number) => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/cloud/${accountId}/test-connection`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
