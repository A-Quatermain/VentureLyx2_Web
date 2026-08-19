import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

const COPY = {
  Build: "Idea validation, market research, business blueprints, branding, and website generation — all AI-assisted.",
  Source: "Discover suppliers and manufacturers, run RFQs, compare costs, request samples, and manage vendors.",
  Grow: "Lead generation, email & SMS campaigns, funnels, social, and advertising that convert.",
  "AI Team": "Your AI receptionist, sales assistant, SEO specialist, operations and marketing assistants — working 24/7.",
};

export default function LockedModule({ name }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="h-14 w-14 mx-auto rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <div className="mt-5 text-[10px] uppercase tracking-[0.2em] text-primary">Coming soon</div>
        <h1 className="font-heading font-bold text-3xl tracking-tight mt-2">{name}</h1>
        <p className="text-muted-foreground mt-3">{COPY[name] || "This module is on the roadmap."}</p>
        <Button data-testid="locked-back-btn" onClick={() => navigate("/dashboard")} variant="outline" className="rounded-full mt-6">
          Back to Command Center
        </Button>
      </div>
    </div>
  );
}
