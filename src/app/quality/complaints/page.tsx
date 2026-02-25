"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Loader2, MessageSquareWarning, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const statusColors: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  investigating: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  ncr_created: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

interface Complaint {
  id: string;
  complaint_number: string;
  customer_name: string;
  status: string;
  description: string;
  received_date: string;
  created_at: string;
  ncr_id?: string;
}

export default function ComplaintsPage() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ customerName: "", customerPoNumber: "", description: "", claimedIssue: "", receivedDate: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
    });
    fetch("/api/qms/complaints").then(r => r.json()).then(d => {
      setComplaints(Array.isArray(d) ? d : []);
    }).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.customerName || !form.description) return;
    setSaving(true);
    const res = await fetch("/api/qms/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      setNewOpen(false);
      router.push(`/quality/complaints/${data.id}`);
    }
    setSaving(false);
  };

  const daysOpen = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / 86400000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div className="flex-1">
            <h1 className="font-bold">Customer Complaints</h1>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus size={14} className="mr-1" /> New Complaint
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquareWarning size={32} className="mx-auto mb-3 opacity-40" />
            <p>No complaints recorded</p>
          </div>
        ) : (
          <div className="space-y-2">
            {complaints.map(c => (
              <Link key={c.id} href={`/quality/complaints/${c.id}`}>
                <Card className="hover:border-border/80 cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-semibold text-sm">{c.complaint_number}</span>
                        <Badge className={`text-xs border ${statusColors[c.status] || ""}`}>{c.status.replace(/_/g, " ")}</Badge>
                        {c.ncr_id && <Badge variant="outline" className="text-xs">NCR created</Badge>}
                      </div>
                      <p className="text-sm font-medium">{c.customer_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{daysOpen(c.created_at)}d open</p>
                      <p>{new Date(c.received_date).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Customer Complaint</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Customer Name <span className="text-red-400">*</span></Label>
              <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Customer PO Number</Label>
              <Input value={form.customerPoNumber} onChange={e => setForm(f => ({ ...f, customerPoNumber: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Received Date <span className="text-red-400">*</span></Label>
              <Input type="date" value={form.receivedDate} onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Description <span className="text-red-400">*</span></Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="mt-1" placeholder="What is the customer reporting?" />
            </div>
            <div>
              <Label>Claimed Issue</Label>
              <Input value={form.claimedIssue} onChange={e => setForm(f => ({ ...f, claimedIssue: e.target.value }))} className="mt-1" placeholder="Specific quality issue claimed" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.customerName || !form.description || saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Create Complaint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
