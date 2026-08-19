import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus, Trash2, DollarSign, Calendar, Receipt } from "lucide-react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";

const STAGE_LABELS = { new: "New", contacted: "Contacted", qualified: "Qualified", proposal: "Proposal", won: "Won", lost: "Lost" };
const fmt = (n) => "$" + Number(n || 0).toLocaleString();

/* ---------------- Pipeline ---------------- */
function Pipeline() {
  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", value: 0, stage: "new", notes: "" });
  const [dragId, setDragId] = useState(null);

  const load = async () => {
    const { data } = await api.get("/operate/leads");
    setStages(data.stages);
    setLeads(data.leads);
  };
  useEffect(() => { load(); }, []);

  const addLead = async () => {
    if (!form.name) return toast.error("Name required");
    try {
      await api.post("/operate/leads", { ...form, value: Number(form.value) });
      toast.success("Lead added");
      setOpen(false);
      setForm({ name: "", company: "", email: "", phone: "", value: 0, stage: "new", notes: "" });
      load();
    } catch (e) { toast.error("Failed to add lead"); }
  };

  const move = async (leadId, stage) => {
    setLeads((prev) => prev.map((l) => (l.lead_id === leadId ? { ...l, stage } : l)));
    try { await api.put(`/operate/leads/${leadId}/stage`, { stage }); } catch (e) { load(); }
  };

  const del = async (leadId) => {
    await api.delete(`/operate/leads/${leadId}`);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Drag cards between columns to move a deal forward.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-lead-btn" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> Add lead</Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input data-testid="lead-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Company</Label><Input data-testid="lead-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-1" /></div>
                <div><Label>Deal value ($)</Label><Input data-testid="lead-value" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input data-testid="lead-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
                <div><Label>Phone</Label><Input data-testid="lead-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
              </div>
              <div><Label>Notes</Label><Textarea data-testid="lead-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
            </div>
            <DialogFooter><Button data-testid="save-lead-btn" onClick={addLead} className="rounded-full">Save lead</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const items = leads.filter((l) => l.stage === stage);
          const total = items.reduce((s, l) => s + Number(l.value || 0), 0);
          return (
            <div key={stage} data-testid={`stage-col-${stage}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && move(dragId, stage)}
              className="w-72 shrink-0 rounded-xl border border-border bg-card/40 p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-sm font-medium text-white">{STAGE_LABELS[stage]}</span>
                <span className="text-xs text-muted-foreground">{items.length} · {fmt(total)}</span>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {items.map((l) => (
                  <div key={l.lead_id} draggable onDragStart={() => setDragId(l.lead_id)} onDragEnd={() => setDragId(null)}
                    data-testid={`lead-card-${l.lead_id}`}
                    className="rounded-lg border border-border bg-background p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="font-medium text-sm text-white">{l.name}</div>
                      <button data-testid={`del-lead-${l.lead_id}`} onClick={() => del(l.lead_id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {l.company && <div className="text-xs text-muted-foreground">{l.company}</div>}
                    {Number(l.value) > 0 && <div className="text-xs text-primary mt-1 font-mono">{fmt(l.value)}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Jobs ---------------- */
function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", customer: "", scheduled_for: "", status: "scheduled", notes: "" });

  const load = async () => { const { data } = await api.get("/operate/jobs"); setJobs(data.jobs); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title) return toast.error("Title required");
    await api.post("/operate/jobs", form);
    toast.success("Job scheduled");
    setOpen(false); setForm({ title: "", customer: "", scheduled_for: "", status: "scheduled", notes: "" }); load();
  };
  const toggle = async (job) => {
    const next = job.status === "completed" ? "scheduled" : "completed";
    await api.put(`/operate/jobs/${job.job_id}/status`, { ...job, status: next }); load();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="add-job-btn" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> New job</Button></DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader><DialogTitle>Schedule a job</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title *</Label><Input data-testid="job-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
              <div><Label>Customer</Label><Input data-testid="job-customer" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} className="mt-1" /></div>
              <div><Label>Scheduled for</Label><Input data-testid="job-date" type="date" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} className="mt-1" /></div>
            </div>
            <DialogFooter><Button data-testid="save-job-btn" onClick={add} className="rounded-full">Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.length === 0 && <p className="text-muted-foreground text-sm">No jobs scheduled yet.</p>}
        {jobs.map((j) => (
          <div key={j.job_id} data-testid={`job-card-${j.job_id}`} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> {j.scheduled_for || "Unscheduled"}</div>
            <div className="font-medium text-white mt-2">{j.title}</div>
            <div className="text-sm text-muted-foreground">{j.customer}</div>
            <Button data-testid={`toggle-job-${j.job_id}`} onClick={() => toggle(j)} variant={j.status === "completed" ? "outline" : "default"} size="sm" className="rounded-full mt-3">
              {j.status === "completed" ? "Completed ✓" : "Mark complete"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Invoices ---------------- */
function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer: "", description: "", amount: 0, status: "unpaid", type: "invoice", due_date: "" });

  const load = async () => { const { data } = await api.get("/operate/invoices"); setInvoices(data.invoices); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.customer || !form.amount) return toast.error("Customer and amount required");
    await api.post("/operate/invoices", { ...form, amount: Number(form.amount) });
    toast.success("Invoice created");
    setOpen(false); setForm({ customer: "", description: "", amount: 0, status: "unpaid", type: "invoice", due_date: "" }); load();
  };
  const setStatus = async (inv, status) => { await api.put(`/operate/invoices/${inv.invoice_id}/status`, { status }); load(); };

  const badge = { paid: "bg-emerald-500/15 text-emerald-400", unpaid: "bg-amber-500/15 text-amber-400", overdue: "bg-destructive/15 text-red-400" };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="add-invoice-btn" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> New invoice</Button></DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader><DialogTitle>Create invoice / expense</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Customer / Vendor *</Label><Input data-testid="inv-customer" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} className="mt-1" /></div>
              <div><Label>Description</Label><Input data-testid="inv-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount ($) *</Label><Input data-testid="inv-amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" /></div>
                <div><Label>Type</Label>
                  <select data-testid="inv-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="invoice">Invoice (income)</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter><Button data-testid="save-invoice-btn" onClick={add} className="rounded-full">Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-muted-foreground text-xs uppercase tracking-wider">
            <tr><th className="text-left p-3">Number</th><th className="text-left p-3">Customer</th><th className="text-left p-3">Type</th><th className="text-right p-3">Amount</th><th className="text-left p-3">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No invoices yet.</td></tr>}
            {invoices.map((inv) => (
              <tr key={inv.invoice_id} data-testid={`invoice-row-${inv.invoice_id}`} className="border-t border-border">
                <td className="p-3 font-mono text-xs">{inv.number}</td>
                <td className="p-3 text-white">{inv.customer}</td>
                <td className="p-3 capitalize text-muted-foreground">{inv.type}</td>
                <td className="p-3 text-right font-mono">{fmt(inv.amount)}</td>
                <td className="p-3"><span className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${badge[inv.status]}`}>{inv.status}</span></td>
                <td className="p-3 text-right">
                  {inv.status !== "paid" && <Button data-testid={`mark-paid-${inv.invoice_id}`} onClick={() => setStatus(inv, "paid")} size="sm" variant="outline" className="rounded-full">Mark paid</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Operate() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Operate</div>
        <h1 className="font-heading font-black text-3xl tracking-tight mt-1">Run your business</h1>
      </div>
      <Tabs defaultValue="pipeline">
        <TabsList className="bg-card">
          <TabsTrigger data-testid="tab-pipeline" value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger data-testid="tab-jobs" value="jobs">Jobs</TabsTrigger>
          <TabsTrigger data-testid="tab-invoices" value="invoices">Invoices</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-6"><Pipeline /></TabsContent>
        <TabsContent value="jobs" className="mt-6"><Jobs /></TabsContent>
        <TabsContent value="invoices" className="mt-6"><Invoices /></TabsContent>
      </Tabs>
    </div>
  );
}
