import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import axios from "axios";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

interface CloudTagUser {
  id: number;
  email: string;
  display_name: string;
  role: "USER" | "ADMIN";
}

interface AuthContextType {
  user: CloudTagUser | null;
  loading: boolean;
  getToken: () => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  getToken: async () => null,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const authMode = import.meta.env.VITE_AUTH_MODE || "entra";
  
  // Entra ID states
  const { instance, accounts } = useMsal();
  const isAuthenticatedMsal = useIsAuthenticated();
  
  // Local auth states
  const [localToken, setLocalToken] = useState<string | null>(localStorage.getItem("cloudtag_local_token"));
  
  // Shared states
  const [user, setUser] = useState<CloudTagUser | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = async () => {
    if (authMode === "local") {
      return localStorage.getItem("cloudtag_local_token");
    }
    
    // Entra flow
    if (accounts.length > 0) {
      try {
        const response = await instance.acquireTokenSilent({
          scopes: ["User.Read"],
          account: accounts[0]
        });
        return response.accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect({
            scopes: ["User.Read"]
          });
        }
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      const isAuthed = authMode === "local" ? !!localToken : isAuthenticatedMsal;
      
      if (isAuthed) {
        try {
          const token = await getToken();
          if (token) {
            const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
            const response = await axios.get(`${apiBase}/api/auth/me`, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            setUser(response.data);
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          if (authMode === "local") {
            localStorage.removeItem("cloudtag_local_token");
            setLocalToken(null);
          }
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    fetchUserProfile();
  }, [isAuthenticatedMsal, accounts, instance, localToken, authMode]);

  const logout = () => {
    if (authMode === "local") {
      localStorage.removeItem("cloudtag_local_token");
      setLocalToken(null);
      setUser(null);
      window.location.href = "/login";
    } else {
      instance.logoutRedirect({
        postLogoutRedirectUri: "/"
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, getToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
