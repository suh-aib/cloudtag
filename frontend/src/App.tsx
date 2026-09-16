import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { AuthProvider } from "./contexts/AuthContext";
import { RequireAuth, RequireAdmin } from "./components/layout/ProtectedRoute";
import Login from "./pages/common/Login";

import Dashboard from "./pages/user/Dashboard";
import Azure from "./pages/user/Azure";
import AzureResourceGroups from "./pages/user/AzureResourceGroups";
import AzureResourceTypes from "./pages/user/AzureResourceTypes";
import AzureResourceList from "./pages/user/AzureResourceList";
import AWS from "./pages/user/AWS";
import AWSRegions from "./pages/user/AWSRegions";
import AWSTypes from "./pages/user/AWSTypes";
import AWSResources from "./pages/user/AWSResources";
import MyTasks from "./pages/user/MyTasks";
import TaskDetail from "./pages/user/TaskDetail";
import SavedTags from "./pages/user/SavedTags";
import MySubmissions from "./pages/user/MySubmissions";
import SubmissionDetails from "./pages/user/SubmissionDetails";
import ApprovedWork from "./pages/user/ApprovedWork";
import BulkTaggingHome from "./pages/user/BulkTaggingHome";
import BulkTaggingWizard from "./pages/user/BulkTaggingWizard";

import MyTaggingProgress from "./pages/user/MyTaggingProgress";

import UsersRoles from "./pages/admin/UsersRoles";
import CloudConfiguration from "./pages/admin/CloudConfiguration";
import DataSources from "./pages/admin/DataSources";
import TagConfiguration from "./pages/admin/TagConfiguration";
import AdminSavedTags from "./pages/admin/AdminSavedTags";
import AssignedTags from "./pages/admin/AssignedTags";
import ScriptGeneration from "./pages/admin/ScriptGeneration";
import AuditLogs from "./pages/admin/AuditLogs";
import ApprovalWorkspace from "./pages/admin/ApprovalWorkspace";
import TaggingApprovals from "./pages/admin/TaggingApprovals";
import UserTagProgress from "./pages/admin/UserTagProgress";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AssignTask from "./pages/admin/AssignTask";
import AssignedTasks from "./pages/admin/AssignedTasks";

import NotFound from "./pages/common/NotFound";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<RequireAuth />}>
            <Route path="/" element={<MainLayout />}>
              {/* User Routes */}
              <Route index element={<Dashboard />} />
              <Route path="azure" element={<Azure />} />
              <Route path="azure/:subscription" element={<AzureResourceGroups />} />
              <Route path="azure/:subscription/:resourceGroup" element={<AzureResourceTypes />} />
              <Route path="azure/:subscription/:resourceGroup/:resourceType" element={<AzureResourceList />} />
              <Route path="aws" element={<AWS />} />
              <Route path="aws/:accountId" element={<AWSRegions />} />
              <Route path="aws/:accountId/:region" element={<AWSTypes />} />
              <Route path="aws/:accountId/:region/:resourceType" element={<AWSResources />} />
              <Route path="my-tasks" element={<MyTasks />} />
              <Route path="my-tasks/:provider/:taskId" element={<TaskDetail />} />
              <Route path="my-tagging" element={<Navigate to="/my-tasks" replace />} />
              <Route path="saved-tags" element={<SavedTags />} />
              <Route path="my-submissions" element={<MySubmissions />} />
              <Route path="my-submissions/:batchId" element={<SubmissionDetails />} />
              <Route path="approved" element={<ApprovedWork />} />
              <Route path="bulk-tagging" element={<BulkTaggingHome />} />
              <Route path="bulk-tagging/wizard" element={<BulkTaggingWizard />} />

              <Route path="my-tagging-progress" element={<MyTaggingProgress />} />

              {/* Admin Routes */}
              <Route path="admin" element={<RequireAdmin />}>
                <Route index element={<Navigate to="/" replace />} />
                <Route path="users-roles" element={<UsersRoles />} />
                <Route path="cloud-configuration" element={<CloudConfiguration />} />
                <Route path="data-sources" element={<DataSources />} />
                <Route path="tag-configuration" element={<TagConfiguration />} />
                
                {/* Legacy Redirects */}
                <Route path="tag-values" element={<Navigate to="/admin/tag-configuration" replace />} />
                <Route path="approvals" element={<Navigate to="/admin/tagging-approvals" replace />} />
                <Route path="approved-work" element={<Navigate to="/admin/tagging-approvals?tab=approved" replace />} />
                <Route path="tagging-progress" element={<Navigate to="/my-tagging-progress" replace />} />
                <Route path="user-tag-progress" element={<Navigate to="/admin/user-tasks/progress" replace />} />
                <Route path="user-tag-progress/:userId" element={<Navigate to="/admin/user-tasks/progress/:userId" replace />} />

                <Route path="tagging-approvals" element={<TaggingApprovals />} />
                <Route path="tagging-approvals/:batchId" element={<ApprovalWorkspace />} />
                
                <Route path="user-tasks/assign" element={<AssignTask />} />
                <Route path="user-tasks/assigned" element={<AssignedTasks />} />
                <Route path="user-tasks/progress" element={<UserTagProgress />} />
                <Route path="user-tasks/progress/:userId" element={<AdminUserDetail />} />
                <Route path="user-tasks/progress/:userId/task/:provider/:taskId" element={<TaskDetail adminMode={true} />} />

                <Route path="saved-tags" element={<AdminSavedTags />} />
                <Route path="assigned-tags" element={<AssignedTags />} />
                <Route path="script-generation" element={<ScriptGeneration />} />
                <Route path="audit-logs" element={<AuditLogs />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
