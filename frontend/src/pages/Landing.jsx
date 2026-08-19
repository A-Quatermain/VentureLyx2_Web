import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, Briefcase, Star, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { Button } from "../components/ui/button";

const MODULES = [
  { name: "Build", desc: "Idea → blueprint → brand → site", soon: true },
  { name: "Source", desc: "Suppliers, RFQs, cost compares", soon: true },
  { name: "Operate", desc: "CRM, jobs, invoices, payments", soon: false },
  { name: "ScaleSEO", desc: "Get found. Fix what's broken.", soon: false },
  { name: "Grow", desc: "Leads, email/SMS, funnels, ads", soon: true },
  { name: "AI Team", desc: "Receptionist, sales, SEO agents", soon: true },
];

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* header */}
      <header className="glass sticky top-0 z-30 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center font-heading font-black text-white">V</div>
            <span className="font-heading font-black tracking-tight text-lg">Venturelyx</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" data-testid="header-login-link" className="text-sm text-muted-foreground hover:text-white transition-colors">Log in</Link>
            <Button data-testid="header-signup-btn" onClick={() => navigate("/register")} className="rounded-full">Get started</Button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative max-w-7xl mx-auto px-6 pt-20 pb-16">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary mb-6 border border-primary/30 rounded-full px-3 py-1">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Claude + ChatGPT
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter leading-[1.05]">
            We build businesses,<br />not websites.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            One command center that takes your small business from idea to launch to scale.
            We find the 7 things stopping customers from finding you — then fix them for you.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button data-testid="hero-start-btn" onClick={() => navigate("/register")} size="lg" className="rounded-full">
              Start free <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button data-testid="hero-login-btn" onClick={() => navigate("/login")} size="lg" variant="outline" className="rounded-full">
              I have an account
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Owner-approved AI</span>
            <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Multi-model routing</span>
            <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> One Growth Score</span>
          </div>
        </motion.div>
      </section>

      {/* feature triad */}
      <section className="max-w-7xl mx-auto px-6 pb-16 grid md:grid-cols-3 gap-5">
        {[
          { icon: Briefcase, title: "Operate", copy: "Track leads through a pipeline, schedule jobs, and send invoices — all in one place." },
          { icon: TrendingUp, title: "ScaleSEO", copy: "Scan your website, get a health score, and let AI write fixes in plain English." },
          { icon: Star, title: "Reviews", copy: "Track your reputation and draft warm, on-brand review replies with AI." },
        ].map((f, i) => (
          <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: i * 0.1 }}
            className="rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="font-heading font-bold text-xl mt-4">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{f.copy}</p>
          </motion.div>
        ))}
      </section>

      {/* modules */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <h2 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight mb-2">Six modules. One platform.</h2>
        <p className="text-muted-foreground mb-8">Start with what you need. The rest unlocks as you grow.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <div key={m.name} className="rounded-xl border border-border bg-card/60 p-5 flex items-start justify-between">
              <div>
                <div className="font-heading font-bold">{m.name}</div>
                <div className="text-sm text-muted-foreground mt-1">{m.desc}</div>
              </div>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${m.soon ? "bg-white/5 text-muted-foreground" : "bg-primary/15 text-primary"}`}>
                {m.soon ? "Soon" : "Live"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © 2026 Venturelyx · We build businesses, not websites.
      </footer>
    </div>
  );
}
