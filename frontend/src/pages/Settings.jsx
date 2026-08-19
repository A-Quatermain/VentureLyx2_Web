import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cpu, Check } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const OPTIONS = [
  { key: "auto", title: "Auto (Recommended)", desc: "Claude-first with automatic fallback to GPT if a provider is down or rate-limited." },
  { key: "claude", title: "Claude", desc: "Anthropic — Sonnet 4.6 for generation, Sonnet 5 for heavy reasoning, Haiku 4.5 for quick tasks." },
  { key: "gpt", title: "ChatGPT (GPT)", desc: "OpenAI — GPT 5.6 Luna for generation, 5.6 Terra for heavy reasoning, 5.4 Mini for quick tasks." },
];

export default function Settings() {
  const { business, setBusiness } = useAuth();
  const [pref, setPref] = useState(business?.ai_provider_preference || "auto");
  const [labels, setLabels] = useState(null);
  const [form, setForm] = useState({ name: "", website: "", industry: "", service_area: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/ai/models").then(({ data }) => setLabels(data.labels)).catch(() => {});
    if (business) setForm({ name: business.name || "", website: business.website || "", industry: business.industry || "", service_area: business.service_area || "" });
  }, [business]);

  const savePref = async (key) => {
    setPref(key);
    await api.put("/business/settings", { ai_provider_preference: key });
    setBusiness({ ...business, ai_provider_preference: key });
    toast.success("AI model preference updated");
  };

  const saveBusiness = async () => {
    setSaving(true);
    try {
      const { data } = await api.post("/business/onboard", form);
      setBusiness(data);
      toast.success("Business details saved");
    } catch (e) { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Settings</div>
        <h1 className="font-heading font-black text-3xl tracking-tight mt-1">Settings</h1>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1"><Cpu className="h-5 w-5 text-primary" /><h2 className="font-heading font-bold text-xl">AI Model</h2></div>
        <p className="text-sm text-muted-foreground mb-5">Choose which AI powers your content, recommendations, and replies. You're never locked in.</p>
        <div className="space-y-3">
          {OPTIONS.map((o) => (
            <button key={o.key} data-testid={`ai-pref-${o.key}`} onClick={() => savePref(o.key)}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${pref === o.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{o.title}</span>
                {pref === o.key && <Check className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{o.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-heading font-bold text-xl mb-4">Business details</h2>
        <div className="space-y-4">
          <div><Label>Business name</Label><Input data-testid="settings-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" /></div>
          <div><Label>Website</Label><Input data-testid="settings-website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="mt-1.5" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Industry</Label><Input data-testid="settings-industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Service area</Label><Input data-testid="settings-area" value={form.service_area} onChange={(e) => setForm({ ...form, service_area: e.target.value })} className="mt-1.5" /></div>
          </div>
          <Button data-testid="save-business-btn" onClick={saveBusiness} disabled={saving} className="rounded-full">{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </section>
    </div>
  );
}
