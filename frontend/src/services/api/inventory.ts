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
  billability?: string;
  tagging_scope?: string;
}

export interface ResourceDetail {
  id: number;
  resource_name: string;
  resource_type: string;
  resource_group?: string;
  location?: string;
  resource_id: string;
  cloud_tags?: Record<string, string>;
  billability?: string;
  tagging_scope: string;
  status: string;
}

export interface InventoryFilters {
  search?: string;
  billable_only?: boolean;
  billability?: string;
  tagging_scope?: string;
  resource_type?: string;
  location?: string;
}

const buildQueryString = (filters?: InventoryFilters, additionalParams?: Record<string, string>) => {
  const params = new URLSearchParams();
  
  if (filters) {
    if (filters.search) params.append('search', filters.search);
    if (filters.billable_only) params.append('billable_only', 'true');
    if (filters.billability) params.append('billability', filters.billability);
    if (filters.tagging_scope) params.append('tagging_scope', filters.tagging_scope);
    if (filters.resource_type) params.append('resource_type', filters.resource_type);
    if (filters.location) params.append('location', filters.location);
  }
  
  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }
  
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

export const getDashboardStats = async (token: string, provider?: string): Promise<DashboardStats> => {
  const url = provider 
    ? `${API_BASE_URL}/api/inventory/dashboard/stats?provider=${provider}`
    : `${API_BASE_URL}/api/inventory/dashboard/stats`;
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getProviderAccounts = async (token: string, provider: 'azure' | 'aws', filters?: InventoryFilters): Promise<InventoryAccount[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/${provider}/accounts${buildQueryString(filters)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAzureResourceGroups = async (token: string, accountId: string, filters?: InventoryFilters): Promise<ResourceGroupCount[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/azure/accounts/${encodeURIComponent(accountId)}/resource-groups${buildQueryString(filters)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAzureResourceTypes = async (token: string, accountId: string, resourceGroup: string, filters?: InventoryFilters): Promise<ResourceTypeCount[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/azure/accounts/${encodeURIComponent(accountId)}/resource-groups/${encodeURIComponent(resourceGroup)}/types${buildQueryString(filters)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAzureResources = async (token: string, accountId: string, resourceGroup: string, resourceType?: string, filters?: InventoryFilters): Promise<ResourceDetail[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/azure/accounts/${encodeURIComponent(accountId)}/resource-groups/${encodeURIComponent(resourceGroup)}/resources${buildQueryString(filters, { type: resourceType || '' })}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAWSRegions = async (token: string, accountId: string, filters?: InventoryFilters): Promise<ResourceGroupCount[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/aws/accounts/${encodeURIComponent(accountId)}/regions${buildQueryString(filters)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAWSResourceTypes = async (token: string, accountId: string, region: string, filters?: InventoryFilters): Promise<ResourceTypeCount[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/aws/accounts/${encodeURIComponent(accountId)}/regions/${encodeURIComponent(region)}/types${buildQueryString(filters)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getAWSResources = async (token: string, accountId: string, region: string, resourceType?: string, filters?: InventoryFilters): Promise<ResourceDetail[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/inventory/aws/accounts/${encodeURIComponent(accountId)}/regions/${encodeURIComponent(region)}/resources${buildQueryString(filters, { type: resourceType || '' })}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
