import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function checkJsonResponse(data: any) {
  if (typeof data === "string" && data.trim().startsWith("<!DOCTYPE html>")) {
    throw new Error("API returned HTML instead of expected JSON data. Check routing.");
  }
  return data;
}

export interface ChangeDetail {
  id: number;
  resource_id: number;
  account_name: string;
  account_id_str: string;
  resource_group: string | null;
  resource_type: string;
  resource_name: string;
  tag_key: string;
  previous_value: string | null;
  proposed_value: string | null;
  status: string;
}

export interface BatchApprovalDetail {
  id: number;
  batch_id: string;
  cloud: string;
  scope: string | null;
  status: string;
  created_at: string;
  submitted_by: string;
  changes: ChangeDetail[];
}

export async function getBatchHierarchy(token: string, batchId: string): Promise<BatchApprovalDetail> {
  const res = await axios.get(`${API_BASE_URL}/api/approvals/batches/${batchId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return checkJsonResponse(res.data);
}

export async function decideBatchApproval(
  token: string,
  batchId: string,
  payload: {
    scope_type: string;
    scope_value: string;
    action: string;
    account_id?: string;
    resource_group?: string;
    region?: string;
    resource_type?: string;
  }
) {
  const res = await axios.post(`${API_BASE_URL}/api/approvals/batches/${batchId}/decide`, payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return checkJsonResponse(res.data);
}

import { type BatchResponse } from "./tagging";

export async function getApprovalQueue(token: string): Promise<BatchResponse[]> {
  const res = await axios.get(`${API_BASE_URL}/api/approvals/queue`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return checkJsonResponse(res.data);
}

export async function getApprovedWork(token: string): Promise<BatchResponse[]> {
  const res = await axios.get(`${API_BASE_URL}/api/approvals/approved`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return checkJsonResponse(res.data);
}
