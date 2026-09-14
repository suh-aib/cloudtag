import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const uploadCsvFile = async (token: string, provider: "azure" | "aws", file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await axios.post(`${API_BASE_URL}/api/admin/csv/${provider}/upload`, formData, {
    headers: { 
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data" 
    }
  });
  return response.data;
};

export const getCsvJob = async (token: string, provider: "azure" | "aws", jobId: number) => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/csv/${provider}/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const detectCsvHeaders = async (token: string, provider: "azure" | "aws", jobId: number) => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/csv/${provider}/jobs/${jobId}/headers`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const validateCsvImport = async (token: string, provider: "azure" | "aws", jobId: number, mappings: any[]) => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/csv/${provider}/jobs/${jobId}/validate`, { mappings }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const executeCsvImport = async (token: string, provider: "azure" | "aws", jobId: number) => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/csv/${provider}/jobs/${jobId}/import`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
