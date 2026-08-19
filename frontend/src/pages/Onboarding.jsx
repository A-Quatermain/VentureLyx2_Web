import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const INDUSTRIES = ["Pool Service", "HVAC", "Landscaping", "Cleaning", "Plumbing", "Electrical", "Roofing", "Ecommerce", "Restaurant", "Salon & Spa", "Other"];

export default function Onboarding() {
  const [form, setForm] = useState({ name: "", website: "", industry: "", service_area: "" });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { setBusiness } = useAuth();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error("Business name is required");
    setBusy(true);
    try {
      const { data } = await api.post("/business/onboard", form);
      setBusiness(data);
      toast.success("You're all set!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center font-heading font-black text-white">V</div>
          <span className="font-heading font-black tracking-tight text-lg">Venturelyx</span>
        </div>
        <h1 className="font-heading font-bold text-3xl tracking-tight">Tell us about your business</h1>
        <p className="text-muted-foreground mt-2 mb-8">This powers your Command Center and every AI recommendation.</p>

        <form onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-card p-6">
          <div>
            <Label htmlFor="bname">Business name *</Label>
            <Input id="bname" data-testid="onboard-name" value={form.name} onChange={set("name")} placeholder="Blue Wave Pools" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" data-testid="onboard-website" value={form.website} onChange={set("website")} placeholder="https://bluewavepools.com" className="mt-1.5" />
          </div>
          <div>
            <Label>Industry</Label>
            <select data-testid="onboard-industry" value={form.industry} onChange={set("industry")}
              className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select an industry</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="area">Service area</Label>
            <Input id="area" data-testid="onboard-area" value={form.service_area} onChange={set("service_area")} placeholder="Austin, TX" className="mt-1.5" />
          </div>
          <Button data-testid="onboard-submit" type="submit" disabled={busy} className="w-full rounded-full">
            {busy ? "Setting up…" : "Enter Command Center"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
