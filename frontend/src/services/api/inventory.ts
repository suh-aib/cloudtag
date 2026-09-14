import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export interface DashboardStats {
  total_resources: number;
  tagging_required: number;
  validated_resources: number;
  pending_approval_resources: number;
  approved_resources: number;
  assigned_resources: number;
  tagging_completion_percent: number;
}

export interface InventoryAccount {
  account_id?: number;
  account_name: string;
  account_identifier: string;
  resource_count: number;
  group_count: number;
}

export interface ResourceGroupCount {
  name: string;
  locations: string[];
  resource_count: number;
  types_count: number;
}

export interface ResourceTypeCount {
  resource_type: string;
  display_name: string;
  resource_count: number;
}

export interface ResourceDetail {
  id: number;
  resource_name: string;
  resource_type: string;
  resource_group?: string;
  location?: string;
  resource_id: string;
  cloud_tags?: Record<string, string>;
  tagging_scope: string;
  status: string;
}

export const getDashboardStats = async (token: string, provider?: string): Promise<DashboardStats> => {
  const url = provider 
    ? `${API_BASE_URL}/api/inventory/dashboard/stats?provider=${provider}`
    : `${API_BASE_URL}/api/inventory/dashboard/stats`;
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getProviderAccounts = async (token: string, provider: 'azure' | 'aws'): Promise<InventoryAccount[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/${provider}/accounts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAzureResourceGroups = async (token: string, accountId: string): Promise<ResourceGroupCount[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/azure/accounts/${encodeURIComponent(accountId)}/resource-groups`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAzureResourceTypes = async (token: string, accountId: string, resourceGroup: string): Promise<ResourceTypeCount[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/azure/accounts/${encodeURIComponent(accountId)}/resource-groups/${encodeURIComponent(resourceGroup)}/types`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAzureResources = async (token: string, accountId: string, resourceGroup: string, resourceType?: string): Promise<ResourceDetail[]> => {
  let url = `${API_BASE_URL}/api/inventory/azure/accounts/${encodeURIComponent(accountId)}/resource-groups/${encodeURIComponent(resourceGroup)}/resources`;
  if (resourceType) {
    url += `?type=${encodeURIComponent(resourceType)}`;
  }
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAWSRegions = async (token: string, accountId: string): Promise<ResourceGroupCount[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/aws/accounts/${encodeURIComponent(accountId)}/regions`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAWSResourceTypes = async (token: string, accountId: string, region: string): Promise<ResourceTypeCount[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/aws/accounts/${encodeURIComponent(accountId)}/regions/${encodeURIComponent(region)}/types`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAWSResources = async (token: string, accountId: string, region: string, resourceType?: string): Promise<ResourceDetail[]> => {
  let url = `${API_BASE_URL}/api/inventory/aws/accounts/${encodeURIComponent(accountId)}/regions/${encodeURIComponent(region)}/resources`;
  if (resourceType) {
    url += `?type=${encodeURIComponent(resourceType)}`;
  }
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
