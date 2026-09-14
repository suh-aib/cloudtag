import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";
import {
  LayoutDashboard,
  Cloud,
  Tag,
  Save,
  Clock,
  CheckCircle,
  Terminal,
  Settings,
  Users,
  Database,
  FileSpreadsheet,
  Activity,
  History,
  Server
} from "lucide-react";

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/" && location.pathname !== "/") return false;
    if (path === "/admin" && location.pathname !== "/admin") return false;
    return location.pathname.startsWith(path);
  };

  const NavItem = ({ to, icon: Icon, label, customActiveColor }: { to: string, icon: any, label: string, customActiveColor?: string }) => (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors mb-1",
        isActive(to)
          ? customActiveColor || "bg-azure text-white shadow-sm"
          : "text-slate-300 hover:bg-navy-800 hover:text-white"
      )}
    >
      <Icon size={18} className={cn(isActive(to) ? "text-white" : "text-slate-400")} />
      {label}
    </Link>
  );

  return (
    <aside className="w-64 bg-navy-950 text-white border-r border-navy-800 min-h-screen flex flex-col z-10 shadow-xl">
      <div className="h-[72px] flex items-center px-5 border-b border-navy-800 bg-navy-900/50">
        <div className="font-bold tracking-tight flex items-center gap-3">
          <div className="bg-gradient-to-br from-azure to-blue-600 p-1.5 rounded-lg shadow-sm">
            <Cloud className="text-white" size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] text-white">CloudTag Allocator</span>
            <span className="text-[10px] text-azure-light font-medium uppercase tracking-widest">Enterprise</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-5 custom-scrollbar">
        <nav className="px-3 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-2 px-3">User</div>
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/azure" icon={Cloud} label="Azure Resources" customActiveColor="bg-azure/20 text-azure-light border border-azure/30" />
          <NavItem to="/aws" icon={Server} label="AWS Resources" customActiveColor="bg-aws/20 text-aws-light border border-aws/30" />
          <NavItem to="/bulk-tagging" icon={Tag} label="Bulk Tagging" customActiveColor="bg-purple-500/20 text-purple-300 border border-purple-500/30" />
          <NavItem to="/my-tagging" icon={Tag} label="My Tagging" />
          <NavItem to="/saved-tags" icon={Save} label="Saved Tags" />
          <NavItem to="/my-submissions" icon={Clock} label="My Submissions" />
          <NavItem to="/approved" icon={CheckCircle} label="Approved" />
          <NavItem to="/jobs" icon={Terminal} label="Jobs" />

          {user?.role === "ADMIN" && (
            <>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-8 px-3">Admin</div>
              <NavItem to="/admin" icon={Activity} label="Overview" />
              <NavItem to="/admin/users-roles" icon={Users} label="Users & Roles" />
              <NavItem to="/admin/cloud-configuration" icon={Settings} label="Cloud Configuration" />
              <NavItem to="/admin/data-sources" icon={Database} label="Data Sources" />
              <NavItem to="/admin/tag-configuration" icon={FileSpreadsheet} label="Tag Configuration" />
              <NavItem to="/admin/tag-values" icon={Tag} label="Tag Values" />
              <NavItem to="/admin/approvals" icon={Clock} label="Approval Queue" />
              <NavItem to="/admin/approved-work" icon={CheckCircle} label="Approved Work" />
              <NavItem to="/admin/tagging-progress" icon={Activity} label="Tagging Progress" />
              <NavItem to="/admin/script-generation" icon={Terminal} label="Script Jobs" />
              <NavItem to="/admin/audit-logs" icon={History} label="Audit Logs" />
            </>
          )}
        </nav>
      </div>
    </aside>
  );
}
