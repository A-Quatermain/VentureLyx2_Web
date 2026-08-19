import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { TOKEN_KEY } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setBusiness(data.business || null);
    } catch (e) {
      setUser(null);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If returning from Google OAuth, let AuthCallback establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const loginWithToken = (token, userData) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {}
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, business, loading, setUser, setBusiness, loginWithToken, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
