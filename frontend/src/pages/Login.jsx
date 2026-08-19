import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const GOOGLE_AUTH = "https://auth.emergentagent.com/";

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <div className="hidden lg:flex flex-col justify-between w-[42%] border-r border-border p-12 relative overflow-hidden">
        <div className="absolute -bottom-24 -left-16 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <Link to="/" className="flex items-center gap-2 relative">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center font-heading font-black text-white">V</div>
          <span className="font-heading font-black tracking-tight text-lg">Venturelyx</span>
        </Link>
        <div className="relative">
          <h2 className="font-heading font-black text-4xl tracking-tighter leading-[1.1]">We build businesses, not websites.</h2>
          <p className="text-muted-foreground mt-4 max-w-sm">Your idea, launch, operations, and growth — reporting into one command center.</p>
        </div>
        <div className="text-xs text-muted-foreground relative">© 2026 Venturelyx</div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="font-heading font-bold text-3xl tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-2 mb-8">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function GoogleButton() {
  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `${GOOGLE_AUTH}?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  return (
    <Button data-testid="google-auth-btn" onClick={handleGoogle} variant="outline" className="w-full rounded-full">
      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M12 11v2.8h4.6c-.2 1.2-1.4 3.6-4.6 3.6-2.8 0-5-2.3-5-5.1s2.2-5.1 5-5.1c1.6 0 2.6.7 3.2 1.2l2.2-2.1C17.9 4.9 15.2 3.8 12 3.8 6.9 3.8 2.8 7.9 2.8 13S6.9 22.2 12 22.2c5.9 0 9.8-4.1 9.8-9.9 0-.7-.1-1.2-.2-1.7H12z"/></svg>
      Continue with Google
    </Button>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { loginWithToken, checkAuth } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      loginWithToken(data.token, data.user);
      await checkAuth();
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Log in" subtitle="Pick up where your business left off.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" />
        </div>
        <Button data-testid="login-submit" type="submit" disabled={busy} className="w-full rounded-full">
          {busy ? "Logging in..." : "Log in"}
        </Button>
      </form>
      <div className="flex items-center gap-3 my-5 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />
      <p className="text-sm text-muted-foreground mt-6 text-center">
        No account? <Link to="/register" data-testid="to-register-link" className="text-primary hover:underline">Sign up</Link>
      </p>
    </AuthShell>
  );
}

export { AuthShell };
