#!/bin/bash
mkdir -p src/components/layout src/pages/user src/pages/admin src/pages/common

# Create layout components
cat << 'LAYOUT_EOF' > src/components/layout/Sidebar.tsx
import { Link } from "react-router-dom";

export function Sidebar() {
  return (
    <aside className="w-64 bg-gray-50 border-r min-h-screen flex flex-col">
      <div className="p-4 border-b font-bold text-lg text-primary">CloudTag</div>
      <div className="flex-1 overflow-y-auto">
        <nav className="p-2 space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4 px-2">User</div>
          <Link to="/" className="block px-3 py-2 rounded-md hover:bg-gray-100">Dashboard</Link>
          <Link to="/azure" className="block px-3 py-2 rounded-md hover:bg-gray-100">Azure</Link>
          <Link to="/aws" className="block px-3 py-2 rounded-md hover:bg-gray-100">AWS</Link>
          <Link to="/my-tagging" className="block px-3 py-2 rounded-md hover:bg-gray-100">My Tagging</Link>
          <Link to="/saved-tags" className="block px-3 py-2 rounded-md hover:bg-gray-100">Saved Tags</Link>
          <Link to="/pending" className="block px-3 py-2 rounded-md hover:bg-gray-100">Pending</Link>
          <Link to="/approved" className="block px-3 py-2 rounded-md hover:bg-gray-100">Approved</Link>
          <Link to="/jobs" className="block px-3 py-2 rounded-md hover:bg-gray-100">Jobs</Link>

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-6 px-2">Admin</div>
          <Link to="/admin" className="block px-3 py-2 rounded-md hover:bg-gray-100">Overview</Link>
          <Link to="/admin/users-roles" className="block px-3 py-2 rounded-md hover:bg-gray-100">Users & Roles</Link>
          <Link to="/admin/cloud-configuration" className="block px-3 py-2 rounded-md hover:bg-gray-100">Cloud Config</Link>
          <Link to="/admin/sharepoint-configuration" className="block px-3 py-2 rounded-md hover:bg-gray-100">SharePoint Config</Link>
          <Link to="/admin/tag-configuration" className="block px-3 py-2 rounded-md hover:bg-gray-100">Tag Config</Link>
          <Link to="/admin/tag-values" className="block px-3 py-2 rounded-md hover:bg-gray-100">Tag Values</Link>
          <Link to="/admin/application-master" className="block px-3 py-2 rounded-md hover:bg-gray-100">App Master</Link>
          <Link to="/admin/project-master" className="block px-3 py-2 rounded-md hover:bg-gray-100">Project Master</Link>
          <Link to="/admin/saved-tags" className="block px-3 py-2 rounded-md hover:bg-gray-100">Saved Tags (Admin)</Link>
          <Link to="/admin/assigned-tags" className="block px-3 py-2 rounded-md hover:bg-gray-100">Assigned Tags</Link>
          <Link to="/admin/tagging-progress" className="block px-3 py-2 rounded-md hover:bg-gray-100">Tagging Progress</Link>
          <Link to="/admin/user-saved-work" className="block px-3 py-2 rounded-md hover:bg-gray-100">User Saved Work</Link>
          <Link to="/admin/script-generation" className="block px-3 py-2 rounded-md hover:bg-gray-100">Script Generation</Link>
          <Link to="/admin/audit-logs" className="block px-3 py-2 rounded-md hover:bg-gray-100">Audit Logs</Link>
        </nav>
      </div>
    </aside>
  );
}
LAYOUT_EOF

cat << 'LAYOUT_EOF' > src/components/layout/Header.tsx
import { User } from "lucide-react";

export function Header() {
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <div className="font-semibold text-xl">CloudTag</div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <User size={16} />
        </div>
        <span className="text-sm font-medium">John Doe (Placeholder)</span>
      </div>
    </header>
  );
}
LAYOUT_EOF

cat << 'LAYOUT_EOF' > src/components/layout/MainLayout.tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function MainLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
LAYOUT_EOF

# Common
cat << 'COMP_EOF' > src/pages/common/NotFound.tsx
export default function NotFound() {
  return <div className="p-4"><h1>404 - Not Found</h1></div>;
}
COMP_EOF

# User Pages
pages=( "Dashboard" "Azure" "AWS" "MyTagging" "SavedTags" "Pending" "Approved" "Jobs" )
for page in "${pages[@]}"; do
cat << COMP_EOF > src/pages/user/${page}.tsx
export default function ${page}() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">${page}</h1>
      <p className="text-gray-500">This is a placeholder page for ${page}.</p>
    </div>
  );
}
COMP_EOF
done

# Admin Pages
admin_pages=( "AdminOverview" "UsersRoles" "CloudConfiguration" "SharePointConfiguration" "TagConfiguration" "TagValues" "ApplicationMaster" "ProjectMaster" "AdminSavedTags" "AssignedTags" "TaggingProgress" "UserSavedWork" "ScriptGeneration" "AuditLogs" )
for page in "${admin_pages[@]}"; do
cat << COMP_EOF > src/pages/admin/${page}.tsx
export default function ${page}() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin: ${page}</h1>
      <p className="text-gray-500">This is a placeholder page for Admin ${page}.</p>
    </div>
  );
}
COMP_EOF
done

