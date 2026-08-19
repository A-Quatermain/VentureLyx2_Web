import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Star, Plus, Sparkles, Check, Send } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import api, { streamPost } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";

function Stars({ n }) {
  return <span className="text-amber-400">{"★".repeat(n)}<span className="text-muted-foreground">{"★".repeat(5 - n)}</span></span>;
}

export default function Reviews() {
  const [data, setData] = useState({ reviews: [], meta: { rating: 0, count: 0 }, trend: [], requests: [] });
  const [open, setOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [form, setForm] = useState({ author: "", rating: 5, text: "", source: "Google" });
  const [reqForm, setReqForm] = useState({ customer_name: "", customer_contact: "" });
  const [drafts, setDrafts] = useState({});
  const [streamingId, setStreamingId] = useState(null);

  const load = async () => { const { data } = await api.get("/reviews"); setData(data); };
  useEffect(() => { load(); }, []);

  const addReview = async () => {
    if (!form.author) return toast.error("Author required");
    await api.post("/reviews", { ...form, rating: Number(form.rating) });
    toast.success("Review added"); setOpen(false); setForm({ author: "", rating: 5, text: "", source: "Google" }); load();
  };

  const draftResponse = async (review) => {
    setStreamingId(review.review_id);
    setDrafts((d) => ({ ...d, [review.review_id]: "" }));
    try {
      await streamPost("/reviews/respond", { review_id: review.review_id }, (_c, full) => {
        setDrafts((d) => ({ ...d, [review.review_id]: full }));
      });
    } catch (e) { toast.error("Draft failed"); }
    finally { setStreamingId(null); }
  };

  const approve = async (review) => {
    await api.post("/reviews/approve", { review_id: review.review_id, response: drafts[review.review_id] });
    toast.success("Response approved & saved"); load();
  };

  const sendRequest = async () => {
    if (!reqForm.customer_name || !reqForm.customer_contact) return toast.error("All fields required");
    await api.post("/reviews/request", reqForm);
    toast.success("Review request logged"); setReqOpen(false); setReqForm({ customer_name: "", customer_contact: "" }); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Reviews</div>
          <h1 className="font-heading font-black text-3xl tracking-tight mt-1">Your reputation</h1>
        </div>
        <div className="flex gap-2">
          <Dialog open={reqOpen} onOpenChange={setReqOpen}>
            <DialogTrigger asChild><Button data-testid="request-review-btn" variant="outline" className="rounded-full"><Send className="h-4 w-4 mr-1" /> Request review</Button></DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader><DialogTitle>Request a review</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Customer name</Label><Input data-testid="req-name" value={reqForm.customer_name} onChange={(e) => setReqForm({ ...reqForm, customer_name: e.target.value })} className="mt-1" /></div>
                <div><Label>Email or phone</Label><Input data-testid="req-contact" value={reqForm.customer_contact} onChange={(e) => setReqForm({ ...reqForm, customer_contact: e.target.value })} className="mt-1" /></div>
              </div>
              <DialogFooter><Button data-testid="send-request-btn" onClick={sendRequest} className="rounded-full">Send request</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="add-review-btn" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> Add review</Button></DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader><DialogTitle>Log a review</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Author</Label><Input data-testid="review-author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="mt-1" /></div>
                <div><Label>Rating</Label>
                  <select data-testid="review-rating" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
                  </select>
                </div>
                <div><Label>Review text</Label><Textarea data-testid="review-text" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className="mt-1" /></div>
              </div>
              <DialogFooter><Button data-testid="save-review-btn" onClick={addReview} className="rounded-full">Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center">
          <div className="font-heading font-black text-5xl text-white">{data.meta.rating || 0}</div>
          <div className="mt-2"><Stars n={Math.round(data.meta.rating)} /></div>
          <div className="text-xs text-muted-foreground mt-2">{data.meta.count} reviews</div>
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <h3 className="font-medium mb-3">Monthly trend</h3>
          {data.trend.length === 0 ? <p className="text-sm text-muted-foreground">Add reviews to see your trend.</p> : (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={data.trend}>
                <XAxis dataKey="month" stroke="hsl(240 5% 65%)" fontSize={11} />
                <YAxis domain={[0, 5]} stroke="hsl(240 5% 65%)" fontSize={11} width={24} />
                <Tooltip contentStyle={{ background: "hsl(240 6% 10%)", border: "1px solid hsl(240 4% 16%)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {data.reviews.length === 0 && <p className="text-muted-foreground text-sm">No reviews yet. Add your first one above.</p>}
        {data.reviews.map((r) => (
          <motion.div key={r.review_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            data-testid={`review-${r.review_id}`} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm text-white">{r.author?.[0]}</div>
                <div><div className="font-medium text-white">{r.author}</div><Stars n={r.rating} /></div>
              </div>
              <span className="text-xs text-muted-foreground">{r.source}</span>
            </div>
            {r.text && <p className="text-sm text-muted-foreground mt-3">{r.text}</p>}

            {r.ai_response ? (
              <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-primary mb-1">Your published reply</div>
                <p className="text-sm text-white">{r.ai_response}</p>
              </div>
            ) : (
              <div className="mt-3">
                {drafts[r.review_id] !== undefined && (
                  <Textarea data-testid={`draft-${r.review_id}`} value={drafts[r.review_id]}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.review_id]: e.target.value }))}
                    className="mb-2" rows={3} placeholder="AI draft will stream here…" />
                )}
                <div className="flex gap-2">
                  <Button data-testid={`ai-respond-${r.review_id}`} onClick={() => draftResponse(r)} disabled={streamingId === r.review_id} variant="outline" size="sm" className="rounded-full">
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> {streamingId === r.review_id ? "Drafting…" : "AI draft reply"}
                  </Button>
                  {drafts[r.review_id] && streamingId !== r.review_id && (
                    <Button data-testid={`approve-${r.review_id}`} onClick={() => approve(r)} size="sm" className="rounded-full">
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve & publish
                    </Button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
