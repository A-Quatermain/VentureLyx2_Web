import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Hammer, PackageSearch, Briefcase, TrendingUp,
  Star, Rocket, Bot, Settings as SettingsIcon, CreditCard, Lock, LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ACTIVE = [
  { to: "/dashboard", label: "Command Center", icon: LayoutDashboard },
  { to: "/operate", label: "Operate", icon: Briefcase },
  { to: "/scaleseo", label: "ScaleSEO", icon: TrendingUp },
  { to: "/reviews", label: "Reviews", icon: Star },
];
const LOCKED = [
  { to: "/build", label: "Build", icon: Hammer },
  { to: "/source", label: "Source", icon: PackageSearch },
  { to: "/grow", label: "Grow", icon: Rocket },
  { to: "/ai-team", label: "AI Team", icon: Bot },
];
const BOTTOM = [
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/billing", label: "Billing", icon: CreditCard },
];

function Item({ to, label, icon: Icon, locked }) {
  return (
    <NavLink
      to={to}
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 ${
          isActive
            ? "bg-primary/15 text-white border border-primary/40"
            : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {locked && <Lock className="h-3.5 w-3.5 opacity-60" />}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r border-border bg-card/40 flex flex-col z-20">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center font-heading font-black text-white">V</div>
          <div>
            <div className="font-heading font-black tracking-tight text-white leading-none">Venturelyx</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">Command Center</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {ACTIVE.map((i) => <Item key={i.to} {...i} />)}
        <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Coming soon</div>
        {LOCKED.map((i) => <Item key={i.to} {...i} locked />)}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-1">
        {BOTTOM.map((i) => <Item key={i.to} {...i} />)}
        <div className="mt-2 flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-white overflow-hidden">
            {user?.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : (user?.name?.[0] || "U")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{business?.name || user?.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button data-testid="logout-btn" onClick={handleLogout} className="text-muted-foreground hover:text-white transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
