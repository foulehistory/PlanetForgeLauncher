import { Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { API_BASE } from "../config";

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
      const refreshExp   = storage.getItem("refresh-expires-at");
      const now          = Date.now();

      if (!token && !refreshToken) {
        setAuthState("denied");
        return;
      }

      // Toujours valider côté serveur via le refresh token.
      // Ça garantit que l'utilisateur existe encore en DB,
      // même si le JWT local n'est pas encore expiré.
      if (refreshToken && refreshExp && new Date(refreshExp).getTime() > now) {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (res.ok) {
          const data = await res.json();
          storage.setItem("auth-token",      data.access_token);
          storage.setItem("auth-expires-at", data.access_expires_at);
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