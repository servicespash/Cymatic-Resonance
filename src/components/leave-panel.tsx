import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Calendar as CalIcon, Plane, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

type Leave = {
  id: string; type: string; start_date: string; end_date: string;
  reason: string | null; status: "pending" | "approved" | "denied"; created_at: string;
};

const TYPES = ["vacation", "sick", "personal", "other"] as const;

export function LeavePanel() {
  const { user } = useAuth();
  const [list, setList] = useState<Leave[]>([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]>("vacation");
  const [range, setRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("leave_requests").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(10);
    setList((data ?? []) as Leave[]);
  };
  useEffect(() => { refresh(); }, [user]);

  const submit = async () => {
    if (!range?.from || !range?.to) return toast.error("Pick a date range");
    setBusy(true);
    const { error } = await supabase.rpc("request_leave", {
      _type: type,
      _start: format(range.from, "yyyy-MM-dd"),
      _end: format(range.to, "yyyy-MM-dd"),
      _reason: reason || "",
    } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Leave requested");
    setOpen(false); setReason(""); setRange(undefined);
    refresh();
  };

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="size-4 text-accent" />
          <h2 className="font-display text-lg font-semibold">Time off</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
              <Plus className="size-3" /> Request
            </button>
          </DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader><DialogTitle>Request leave</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Type</div>
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map((t) => (
                    <button key={t} onClick={() => setType(t)} className={`rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest ${type === t ? "border-accent/40 bg-accent/10 text-accent" : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Dates</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start bg-white/5 border-white/10 gap-2">
                      <CalIcon className="size-4" />
                      {range?.from && range?.to ? `${format(range.from, "MMM d")} → ${format(range.to, "MMM d")}` : "Pick range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Reason (optional)</div>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Trip, appointment, etc." className="bg-white/5 border-white/10" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={busy} className="bg-frequency text-primary-foreground resonance-glow">
                {busy ? "Submitting…" : "Submit request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="divide-y divide-white/5">
        {list.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No leave requests yet.</div>
        )}
        {list.map((l) => (
          <div key={l.id} className="flex items-center justify-between py-2.5">
            <div>
              <div className="text-sm font-medium capitalize">{l.type} · {l.start_date} → {l.end_date}</div>
              {l.reason && <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{l.reason}</div>}
            </div>
            <StatusPill status={l.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: "pending" | "approved" | "denied" }) {
  const map = {
    pending: "bg-white/5 text-muted-foreground",
    approved: "bg-accent/15 text-accent",
    denied: "bg-red-500/15 text-red-300",
  } as const;
  return <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${map[status]}`}>{status}</span>;
}
