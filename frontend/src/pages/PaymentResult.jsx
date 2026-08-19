import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import api from "../lib/api";
import { Button } from "../components/ui/button";

export default function PaymentResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const isCancel = location.pathname.includes("cancel");
  const [status, setStatus] = useState(isCancel ? "cancelled" : "checking");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (isCancel) return;
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) { setStatus("error"); return; }

    let active = true;
    const poll = async () => {
      if (attempts > 8) { if (active) setStatus("timeout"); return; }
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (!active) return;
        if (data.payment_status === "paid") { setStatus("paid"); return; }
        if (["expired", "failed"].includes(data.payment_status)) { setStatus("error"); return; }
        setTimeout(() => setAttempts((a) => a + 1), 2000);
      } catch (e) { setTimeout(() => setAttempts((a) => a + 1), 2000); }
    };
    poll();
    return () => { active = false; };
  }, [attempts, isCancel, location.search]);

  const content = {
    checking: { icon: <Loader2 className="h-12 w-12 text-primary animate-spin" />, title: "Confirming payment…", sub: "This only takes a moment." },
    paid: { icon: <CheckCircle2 className="h-12 w-12 text-emerald-400" />, title: "You're upgraded!", sub: "Your new plan is active. Time to grow." },
    cancelled: { icon: <XCircle className="h-12 w-12 text-muted-foreground" />, title: "Checkout cancelled", sub: "No charge was made." },
    error: { icon: <XCircle className="h-12 w-12 text-destructive" />, title: "Something went wrong", sub: "Please try again." },
    timeout: { icon: <Loader2 className="h-12 w-12 text-primary" />, title: "Still processing", sub: "Your payment is taking longer than usual." },
  }[status];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-5">{content.icon}</div>
        <h1 className="font-heading font-bold text-2xl">{content.title}</h1>
        <p className="text-muted-foreground mt-2">{content.sub}</p>
        <Button data-testid="payment-continue-btn" onClick={() => navigate("/dashboard")} className="rounded-full mt-6">Back to Command Center</Button>
      </div>
    </div>
  );
}
