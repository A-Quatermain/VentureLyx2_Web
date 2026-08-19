import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AuthShell, GoogleButton } from "./Login";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { loginWithToken, checkAuth } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      loginWithToken(data.token, data.user);
      await checkAuth();
      toast.success("Account created!");
      navigate("/onboarding");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start building your business in minutes.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" data-testid="register-name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" data-testid="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" data-testid="register-password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" />
        </div>
        <Button data-testid="register-submit" type="submit" disabled={busy} className="w-full rounded-full">
          {busy ? "Creating..." : "Create account"}
        </Button>
      </form>
      <div className="flex items-center gap-3 my-5 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />
      <p className="text-sm text-muted-foreground mt-6 text-center">
        Already have an account? <Link to="/login" data-testid="to-login-link" className="text-primary hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
