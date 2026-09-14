import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../../authConfig";
import axios from "axios";

export default function Login() {
  const authMode = import.meta.env.VITE_AUTH_MODE || "entra";
  const { instance } = useMsal();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleMsalLogin = () => {
    instance.loginRedirect(loginRequest).catch((e) => {
      console.error(e);
    });
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await axios.post(`${apiBase}/api/auth/login`, {
        username,
        password
      });
      localStorage.setItem("cloudtag_local_token", res.data.access_token);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            CloudTag
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enterprise Cloud Resource Tagging Platform
          </p>
          {authMode === "local" && (
            <p className="mt-2 text-center text-xs font-semibold text-red-500 uppercase tracking-wide">
              Local Development Mode
            </p>
          )}
        </div>
        
        {authMode === "local" ? (
          <form className="mt-8 space-y-6" onSubmit={handleLocalLogin}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <div className="mt-8">
            <button
              onClick={handleMsalLogin}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Sign in with Microsoft
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
