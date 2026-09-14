import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import MyTagging from "./pages/user/MyTagging";
import SavedTags from "./pages/user/SavedTags";
import MySubmissions from "./pages/user/MySubmissions";
import SubmissionDetails from "./pages/user/SubmissionDetails";
import ApprovedWork from "./pages/user/ApprovedWork";
import BulkTaggingHome from "./pages/user/BulkTaggingHome";
import BulkTaggingWizard from "./pages/user/BulkTaggingWizard";
import Jobs from "./pages/user/Jobs";

import AdminOverview from "./pages/admin/AdminOverview";
import UsersRoles from "./pages/admin/UsersRoles";
import CloudConfiguration from "./pages/admin/CloudConfiguration";
import DataSources from "./pages/admin/DataSources";
import TagConfiguration from "./pages/admin/TagConfiguration";
import TagValues from "./pages/admin/TagValues";
import AdminSavedTags from "./pages/admin/AdminSavedTags";
import AssignedTags from "./pages/admin/AssignedTags";
import TaggingProgress from "./pages/admin/TaggingProgress";
import ScriptGeneration from "./pages/admin/ScriptGeneration";
import AuditLogs from "./pages/admin/AuditLogs";
import ApprovalWorkspace from "./pages/admin/ApprovalWorkspace";
import ApprovalQueue from "./pages/admin/ApprovalQueue";
import AdminApprovedWork from "./pages/admin/AdminApprovedWork";

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
              <Route path="my-tagging" element={<MyTagging />} />
              <Route path="saved-tags" element={<SavedTags />} />
              <Route path="my-submissions" element={<MySubmissions />} />
              <Route path="my-submissions/:batchId" element={<SubmissionDetails />} />
              <Route path="approved" element={<ApprovedWork />} />
              <Route path="bulk-tagging" element={<BulkTaggingHome />} />
              <Route path="bulk-tagging/wizard" element={<BulkTaggingWizard />} />
              <Route path="jobs" element={<Jobs />} />

              {/* Admin Routes */}
              <Route path="admin" element={<RequireAdmin />}>
                <Route index element={<AdminOverview />} />
                <Route path="users-roles" element={<UsersRoles />} />
                <Route path="cloud-configuration" element={<CloudConfiguration />} />
                <Route path="data-sources" element={<DataSources />} />
                <Route path="tag-configuration" element={<TagConfiguration />} />
                <Route path="tag-values" element={<TagValues />} />
                <Route path="saved-tags" element={<AdminSavedTags />} />
                <Route path="assigned-tags" element={<AssignedTags />} />
                <Route path="tagging-progress" element={<TaggingProgress />} />
                <Route path="script-generation" element={<ScriptGeneration />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route path="approvals" element={<ApprovalQueue />} />
                <Route path="approvals/:batchId" element={<ApprovalWorkspace />} />
                <Route path="approved-work" element={<AdminApprovedWork />} />
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
