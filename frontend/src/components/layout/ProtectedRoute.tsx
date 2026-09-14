import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Loading authentication...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function RequireAdmin() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Loading authentication...</div>
      </div>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex h-screen items-center justify-center flex-col">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Unauthorized</h1>
        <p className="text-gray-600">You must be an administrator to access this page.</p>
      </div>
    );
  }

  return <Outlet />;
}
