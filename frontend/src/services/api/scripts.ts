import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function checkJsonResponse(data: any) {
  if (typeof data === "string" && data.trim().startsWith("<!DOCTYPE html>")) {
    throw new Error("API returned HTML instead of expected JSON data. Check routing.");
  }
  return data;
}

export async function generateScriptJob(token: string, batchIds: number[]) {
  const res = await axios.post(`${API_BASE_URL}/api/admin/scripts/generate`, {
    batch_ids: batchIds
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return checkJsonResponse(res.data);
}

export async function getScriptJobs(token: string) {
  const res = await axios.get(`${API_BASE_URL}/api/admin/scripts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return checkJsonResponse(res.data);
}

export async function getScriptJobDetail(token: string, jobId: string) {
  const res = await axios.get(`${API_BASE_URL}/api/admin/scripts/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return checkJsonResponse(res.data);
}

export async function getScriptJobPreview(token: string, jobId: string) {
  const res = await axios.get(`${API_BASE_URL}/api/admin/scripts/${jobId}/preview`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return checkJsonResponse(res.data);
}

export async function downloadScriptPackage(token: string, jobId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/admin/scripts/${jobId}/download`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Download failed');
  }
  return res.blob();
}
