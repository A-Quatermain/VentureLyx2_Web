import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  DollarSign, Users, UserPlus, TrendingUp, Star, Briefcase, Receipt, ArrowRight, Sparkles, RefreshCw,
} from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";

const fmt = (n) => "$" + Number(n || 0).toLocaleString();

function GrowthGauge({ score }) {
  const data = [{ name: "score", value: score, fill: "hsl(var(--primary))" }];
  return (
    <div className="relative h-44 w-44">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "hsl(240 4% 16%)" }} dataKey="value" cornerRadius={20} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading font-black text-4xl text-white">{score}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Growth Score</span>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, testid }) {
  return (
    <div data-testid={testid} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="font-heading font-bold text-2xl mt-3 text-white">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

const IMPACT_COLORS = { High: "bg-primary/15 text-primary", Medium: "bg-amber-500/15 text-amber-400", Low: "bg-white/5 text-muted-foreground" };

export default function CommandCenter() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [actions, setActions] = useState([]);
  const [loadingAI, setLoadingAI] = useState(true);

  const loadMetrics = async () => {
    const { data } = await api.get("/dashboard/metrics");
    setMetrics(data);
  };
  const loadActions = async () => {
    setLoadingAI(true);
    try {
      const { data } = await api.get("/dashboard/next-best-action");
      setActions(data.actions || []);
    } catch (e) {
      setActions([]);
    } finally {
      setLoadingAI(false);
    }
  };

  useEffect(() => { loadMetrics(); loadActions(); }, []);

  const moduleRoute = { ScaleSEO: "/scaleseo", Operate: "/operate", Reviews: "/reviews", Grow: "/grow" };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Command Center</div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tight mt-1">Hi, {business?.name} 👋</h1>
          <p className="text-muted-foreground mt-1">Here's how your business is doing today.</p>
        </div>
      </div>

      {/* Growth score + top metrics */}
      <div className="grid lg:grid-cols-4 gap-5">
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center">
          <GrowthGauge score={metrics?.growth_score ?? 0} />
        </div>
        <div className="lg:col-span-3 grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          <MetricCard testid="metric-revenue" icon={DollarSign} label="Revenue" value={fmt(metrics?.revenue)} sub={`${fmt(metrics?.outstanding)} outstanding`} />
          <MetricCard testid="metric-leads" icon={UserPlus} label="Open Leads" value={metrics?.leads ?? 0} sub={`${fmt(metrics?.pipeline_value)} in pipeline`} />
          <MetricCard testid="metric-customers" icon={Users} label="Customers" value={metrics?.customers ?? 0} sub="Won deals" />
          <MetricCard testid="metric-seo" icon={TrendingUp} label="SEO Score" value={metrics?.seo_score ?? 0} sub="Latest scan" />
          <MetricCard testid="metric-reviews" icon={Star} label="Reviews" value={`${metrics?.rating ?? 0} ★`} sub={`${metrics?.review_count ?? 0} reviews`} />
          <MetricCard testid="metric-jobs" icon={Briefcase} label="Open Jobs" value={metrics?.jobs ?? 0} sub={`${fmt(metrics?.expenses)} expenses`} />
        </div>
      </div>

      {/* Next Best Action */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-bold text-xl">Next Best Actions</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">AI</span>
          </div>
          <Button data-testid="refresh-actions-btn" onClick={loadActions} variant="ghost" size="sm" className="rounded-full">
            <RefreshCw className={`h-4 w-4 ${loadingAI ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loadingAI ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {actions.map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="rounded-lg border border-border bg-background/60 p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-white">{a.title}</h3>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${IMPACT_COLORS[a.impact] || IMPACT_COLORS.Low}`}>{a.impact}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 flex-1">{a.why}</p>
                <Button data-testid={`fix-action-${i}`} onClick={() => navigate(moduleRoute[a.module] || "/dashboard")}
                  variant="outline" size="sm" className="rounded-full mt-3 self-start">
                  Fix this for me <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
