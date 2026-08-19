import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";

export default function Billing() {
  const { business } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(null);

  useEffect(() => { api.get("/payments/plans").then(({ data }) => setPlans(data.plans)); }, []);

  const checkout = async (lookup_key) => {
    setLoading(lookup_key);
    try {
      const { data } = await api.post("/payments/checkout", { lookup_key, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not start checkout");
      setLoading(null);
    }
  };

  const current = business?.plan || "free";

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Billing</div>
        <h1 className="font-heading font-black text-3xl tracking-tight mt-1">Choose your plan</h1>
        <p className="text-muted-foreground mt-1">You're currently on the <span className="text-white capitalize">{current}</span> plan.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {plans.map((p, i) => {
          const active = current === p.name.toLowerCase();
          const featured = p.lookup_key === "managed_monthly";
          return (
            <div key={p.lookup_key} data-testid={`plan-${p.lookup_key}`}
              className={`rounded-xl border p-6 flex flex-col ${featured ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
              {featured && <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary mb-3"><Sparkles className="h-3 w-3" /> Most popular</div>}
              <h3 className="font-heading font-bold text-2xl">{p.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 h-10">{p.tagline}</p>
              <div className="mt-4 mb-5"><span className="font-heading font-black text-4xl text-white">${p.price}</span><span className="text-muted-foreground text-sm">/mo</span></div>
              <ul className="space-y-2 flex-1 mb-6">
                {p.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}</li>)}
              </ul>
              <Button data-testid={`subscribe-${p.lookup_key}`} onClick={() => checkout(p.lookup_key)} disabled={loading === p.lookup_key || active}
                variant={featured ? "default" : "outline"} className="rounded-full w-full">
                {active ? "Current plan" : loading === p.lookup_key ? "Redirecting…" : `Upgrade to ${p.name}`}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Secure checkout by Stripe. Test card: 4242 4242 4242 4242, any future expiry, any CVC.</p>
    </div>
  );
}
