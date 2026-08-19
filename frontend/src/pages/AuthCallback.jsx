import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser, checkAuth } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = location.hash || window.location.hash;
    const sessionId = new URLSearchParams(hash.replace("#", "")).get("session_id");
    if (!sessionId) {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", {}, { headers: { "X-Session-ID": sessionId } });
        setUser(data.user);
        window.history.replaceState({}, document.title, "/dashboard");
        await checkAuth();
        const me = await api.get("/auth/me");
        navigate(me.data.has_business ? "/dashboard" : "/onboarding", { replace: true });
      } catch (e) {
        navigate("/login", { replace: true });
      }
    })();
  }, [location, navigate, setUser, checkAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <div className="h-10 w-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="mt-4 text-muted-foreground text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
