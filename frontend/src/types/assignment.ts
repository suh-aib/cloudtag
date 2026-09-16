/**
 * This represents the future contract for Task Assignments.
 * Currently, it is used for frontend UI state only, as no backend
 * database schema has been implemented for it yet.
 */

export type AssignmentScopeType = 
  // Azure
  | "SUBSCRIPTION"
  | "RESOURCE_GROUP"
  | "RESOURCE_TYPE"
  // AWS
  | "ACCOUNT"
  | "REGION"
  // Shared
  | "RESOURCE_SELECTION";

export type AssignmentStatus = "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED";

export interface AssignmentScope {
  type: AssignmentScopeType;
  // E.g. Subscription ID, Resource Group Name, Account ID
  identifier?: string;
  // For RESOURCE_SELECTION, the explicit list of resource IDs
  resourceIds?: string[];
  // Display string for the scope, e.g. "Production Subscription"
  displayName: string;
}

export interface TaskAssignment {
  id: number;
  task_number: string;
  provider: "AZURE" | "AWS";
  scope_type: string;
  assigned_user_id: number;
  assigned_user_name?: string;
  assigned_by_user_id: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  created_at: string;
  
  resource_count: number;
  completed_resources: number;
  
  subscription_id?: string;
  account_id?: string;
  region_id?: string;
  resource_group?: string;
  resource_type?: string;
}

export interface CreateAssignmentPayload {
  provider: "AZURE" | "AWS";
  assigned_user_id: number;
  scope_type: string;
  subscription_id?: string;
  account_id?: string;
  region_id?: string;
  resource_group?: string;
  resource_type?: string;
  resource_ids?: string[];
}
