import { Navigate } from "react-router-dom";
import { useState, useEffect } from "react";

function getStorage(): Storage {
  return localStorage.getItem("remember-me") === "true" ? localStorage : sessionStorage;
}

function clearTokens() {
  const storage = getStorage();
  storage.removeItem("auth-token");
  storage.removeItem("refresh-token");
  storage.removeItem("auth-expires-at");
  storage.removeItem("refresh-expires-at");
  localStorage.removeItem("remember-me");
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    const check = async () => {
      const storage      = getStorage();
      const token        = storage.getItem("auth-token");
      const refreshToken = storage.getItem("refresh-token");
      const tokenExp     = storage.getItem("auth-expires-at");
      const refreshExp   = storage.getItem("refresh-expires-at");
      const now          = Date.now();

      if (!token && !refreshToken) {
        setAuthState("denied");
        return;
      }

      if (token && tokenExp && new Date(tokenExp).getTime() > now) {
        setAuthState("ok");
        return;
      }

      if (refreshToken && refreshExp && new Date(refreshExp).getTime() > now) {
        const result = await window.api.refresh({ refresh_token: refreshToken });
        if (result.ok && result.data) {
          storage.setItem("auth-token",      result.data.access_token);
          storage.setItem("auth-expires-at", result.data.access_expires_at);
          setAuthState("ok");
          return;
        }
      }

      clearTokens();
      setAuthState("denied");
    };

    check();
  }, []);

  if (authState === "loading") return null;
  if (authState === "denied") return <Navigate to="/" replace />;
  return <>{children}</>;
}