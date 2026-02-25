"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const statusColors: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  investigating: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  ncr_created: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string>("");
  const [complaint, setComplaint] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState("");
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [ncrDialogOpen, setNcrDialogOpen] = useState(false);
  const [ncrSeverity, setNcrSeverity] = useState("major");
  const [saving, setSaving] = useState(false);

  const refresh = async (cid: string) => {
    const d = await fetch(`/api/qms/complaints/${cid}`).then(r => r.json());
    setComplaint(d);
  };

  useEffect(() => {
    params.then(p => {
      setId(p.id);
      return Promise.all([
        fetch("/api/auth").then(r => r.json()),
        fetch(`/api/qms/complaints/${p.id}`).then(r => r.json()),
      ]);
    }).then(([auth, d]) => {
      if (!auth.authenticated) { router.push("/login"); return; }
      setComplaint(d);
      setResolution((d.resolution as string) || "");
    }).finally(() => setLoading(false));
  }, []);

  const handleCreateNcr = async () => {
    setSaving(true);
    const res = await fetch(`/api/qms/complaints/${id}/create-ncr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ severity: ncrSeverity }),
    });
    if (res.ok) {
      const data = await res.json();
      setNcrDialogOpen(false);
      router.push(`/quality/ncr/${data.ncrId}`);
    }
    setSaving(false);
  };

  const handleResolve = async () => {
    if (!resolution.trim()) return;
    setSaving(true);
    await fetch(`/api/qms/complaints/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    setResolveDialogOpen(false);
    await refresh(id);
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!complaint) return null;

  const status = complaint.status as string;
  const isOpen = !["resolved", "closed"].includes(status);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality/complaints"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-mono font-bold">{complaint.complaint_number as string}</h1>
              <Badge className={`text-xs border ${statusColors[status] || ""}`}>{status.replace(/_/g, " ")}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{complaint.customer_name as string}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Actions */}
        {isOpen && (
          <div className="flex gap-2">
            {!complaint.ncr_id && (
              <Button size="sm" variant="outline" onClick={() => setNcrDialogOpen(true)}>
                <AlertTriangle size={14} className="mr-1" /> Create NCR
              </Button>
            )}
            <Button size="sm" onClick={() => setResolveDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 size={14} className="mr-1" /> Mark Resolved
            </Button>
          </div>
        )}

        {/* Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Complaint Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Customer PO: </span>{(complaint.customer_po_number as string) || "—"}</div>
              <div><span className="text-muted-foreground">Received: </span>{new Date(complaint.received_date as string).toLocaleDateString()}</div>
              <div><span className="text-muted-foreground">Created by: </span>{(complaint.created_by_name as string) || "—"}</div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{complaint.description as string}</p>
            </div>
            {!!complaint.claimed_issue && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Claimed Issue</p>
                <p className="text-sm">{complaint.claimed_issue as string}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linked NCR */}
        {!!complaint.ncr_id && (
          <Card className="border-orange-500/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Linked NCR</p>
              <Link href={`/quality/ncr/${complaint.ncr_id as string}`}>
                <Button variant="link" className="p-0 h-auto text-orange-400">View NCR →</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Resolution */}
        {!!complaint.resolution && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Resolution</p>
              <p className="text-sm">{complaint.resolution as string}</p>
              {!!complaint.resolved_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Resolved {new Date(complaint.resolved_at as string).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Create NCR dialog */}
      <Dialog open={ncrDialogOpen} onOpenChange={setNcrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create NCR from Complaint</DialogTitle></DialogHeader>
          <div>
            <Label>Severity</Label>
            <select value={ncrSeverity} onChange={e => setNcrSeverity(e.target.value)}
              className="w-full border border-input bg-background text-sm rounded-md px-3 py-2 mt-1">
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNcrDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateNcr} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Create NCR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Resolve Complaint</DialogTitle></DialogHeader>
          <div>
            <Label>Resolution Notes <span className="text-red-400">*</span></Label>
            <Textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={3} className="mt-1" placeholder="How was this complaint resolved?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={!resolution.trim() || saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
