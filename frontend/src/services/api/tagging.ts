import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export interface TagValue {
  id: number;
  value: string;
  display_name?: string;
  enabled: boolean;
}

export interface TagDefinition {
  id: number;
  provider: 'AZURE' | 'AWS' | 'SHARED';
  name: string;
  description?: string;
  mandatory: boolean;
  enabled: boolean;
  values: TagValue[];
}

export type ScopeType = 'SUBSCRIPTION' | 'RESOURCE_GROUP' | 'RESOURCE_TYPE' | 'RESOURCE_SELECTION' | 'AWS_ACCOUNT';

export interface BulkTagRequest {
  provider: 'AZURE' | 'AWS';
  scope_type: ScopeType;
  account_id?: string;
  resource_group?: string;
  resource_type?: string;
  resource_ids?: number[];
  tags: Record<string, string>;
  status?: string;
}

export interface BatchResponse {
  id: number;
  batch_id: string;
  cloud: 'AZURE' | 'AWS';
  scope: string | null;
  status: string;
  created_at: string;
  resource_count?: number;
  created_by_name?: string;
}

export interface PreviewResourceChange {
  resource_id: number;
  resource_name: string;
  tag_key: string;
  current_value: string;
  proposed_value: string;
  will_change: boolean;
}

export interface PreviewResponse {
  resource_count: number;
  changes: PreviewResourceChange[];
}

export interface BulkTagResponse {
  batch_id: string;
  status: string;
}

export const getTagDefinitions = async (token: string): Promise<TagDefinition[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/tagging/definitions`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data;
};

export const createBulkTaggingProposal = async (token: string, payload: BulkTagRequest): Promise<BulkTagResponse> => {
  const response = await axios.post(`${API_BASE_URL}/api/tagging/bulk`, payload, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data;
};

export const previewBulkTagging = async (token: string, payload: BulkTagRequest): Promise<PreviewResponse> => {
  const response = await axios.post(`${API_BASE_URL}/api/tagging/preview`, payload, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data;
};

export const getBatches = async (token: string, status?: string): Promise<BatchResponse[]> => {
  const params = status ? { status } : {};
  const response = await axios.get(`${API_BASE_URL}/api/tagging/batches`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    params
  });
  return response.data;
};
