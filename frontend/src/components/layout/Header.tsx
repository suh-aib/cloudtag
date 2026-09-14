import { User, LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useLocation, Link } from "react-router-dom";
import React from "react";

export function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Simple breadcrumbs generator based on path
  const generateBreadcrumbs = () => {
    const paths = location.pathname.split("/").filter(Boolean);
    if (paths.length === 0) return <span className="font-semibold text-gray-800">Dashboard</span>;

    return (
      <div className="flex items-center text-sm font-medium">
        {paths.map((path, index) => {
          const isLast = index === paths.length - 1;
          const formattedPath = path.charAt(0).toUpperCase() + path.slice(1).replace("-", " ");
          
          return (
            <React.Fragment key={path}>
              {index > 0 && <ChevronRight size={16} className="text-gray-400 mx-2" />}
              {isLast ? (
                <span className="text-gray-900 font-semibold">{formattedPath}</span>
              ) : (
                <Link to={`/${paths.slice(0, index + 1).join("/")}`} className="text-gray-500 hover:text-blue-600 transition-colors">
                  {formattedPath}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <header className="h-[72px] border-b border-gray-200 bg-white flex items-center justify-between px-8 shadow-sm z-10 sticky top-0">
      <div className="flex items-center gap-4">
        {generateBreadcrumbs()}
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-700">
            {user?.display_name ? user.display_name.charAt(0).toUpperCase() : <User size={18} />}
          </div>
          <div className="flex flex-col text-sm text-right">
            <span className="font-semibold text-gray-900 leading-tight">{user?.display_name || user?.email || "Loading..."}</span>
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">{user?.role}</span>
          </div>
          <ChevronDown size={16} className="text-gray-400 ml-1" />
        </div>
        
        <div className="h-8 w-px bg-gray-200" />
        
        <button 
          onClick={logout}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors bg-gray-50 hover:bg-red-50 px-3 py-2 rounded-md border border-transparent hover:border-red-100"
          title="Sign out"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </header>
  );
}
