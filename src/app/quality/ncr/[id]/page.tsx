"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const severityColors: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  major: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  minor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const NCR_TRANSITIONS: Record<string, Array<{ status: string; label: string }>> = {
  open: [{ status: "under_investigation", label: "Start Investigation" }],
  under_investigation: [{ status: "corrective_action_pending", label: "Request Corrective Action" }],
  corrective_action_pending: [{ status: "corrective_action_taken", label: "Mark CA Taken" }],
  corrective_action_taken: [
    { status: "closed", label: "Close NCR" },
    { status: "under_investigation", label: "Send Back for Review" },
  ],
};

export default function NcrDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string>("");
  const [ncr, setNcr] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [activityNote, setActivityNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const refresh = async (ncrId: string) => {
    const data = await fetch(`/api/qms/ncrs/${ncrId}`).then(r => r.json());
    setNcr(data);
    setEditFields({
      rootCause: (data.root_cause as string) || "",
      rootCauseCategory: (data.root_cause_category as string) || "",
      correctiveAction: (data.corrective_action as string) || "",
      preventiveAction: (data.preventive_action as string) || "",
      verificationNotes: (data.verification_notes as string) || "",
      dispositionAction: (data.disposition_action as string) || "",
      dispositionNotes: (data.disposition_notes as string) || "",
    });
  };

  useEffect(() => {
    params.then(p => {
      setId(p.id);
      return Promise.all([
        fetch("/api/auth").then(r => r.json()),
        fetch(`/api/qms/ncrs/${p.id}`).then(r => r.json()),
      ]);
    }).then(([auth, data]) => {
      if (!auth.authenticated) { router.push("/login"); return; }
      setRole(auth.role);
      setNcr(data);
      setEditFields({
        rootCause: (data.root_cause as string) || "",
        rootCauseCategory: (data.root_cause_category as string) || "",
        correctiveAction: (data.corrective_action as string) || "",
        preventiveAction: (data.preventive_action as string) || "",
        verificationNotes: (data.verification_notes as string) || "",
        dispositionAction: (data.disposition_action as string) || "",
        dispositionNotes: (data.disposition_notes as string) || "",
      });
    }).finally(() => setLoading(false));
  }, []);

  const isManager = ["quality_manager", "admin", "owner"].includes(role);

  const addActivity = async () => {
    if (!activityNote.trim()) return;
    setAddingNote(true);
    await fetch(`/api/qms/ncrs/${id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "Note added", notes: activityNote }),
    });
    setActivityNote("");
    await refresh(id);
    setAddingNote(false);
  };

  const transition = async (status: string) => {
    if (status === "closed") {
      router.push(`#`);
      await fetch(`/api/qms/ncrs/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Closed" }),
      });
    } else {
      setTransitioning(true);
      await fetch(`/api/qms/ncrs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setTransitioning(false);
    }
    await refresh(id);
  };

  const save = async () => {
    setSaving(true);
    await fetch(`/api/qms/ncrs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editFields),
    });
    await refresh(id);
    setSaving(false);
  };

  const cancel = async () => {
    await fetch(`/api/qms/ncrs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setCancelDialogOpen(false);
    router.push("/quality/ncr");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!ncr) return null;

  const ncrStatus = ncr.status as string;
  const transitions = isManager ? (NCR_TRANSITIONS[ncrStatus] || []) : [];
  const activities = (ncr.activities || []) as Array<Record<string, unknown>>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality/ncr"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-mono font-bold">{ncr.ncr_number as string}</h1>
              <Badge className={`text-xs border ${severityColors[ncr.severity as string] || ""}`}>{ncr.severity as string}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{ncrStatus.replace(/_/g, " ")}</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{ncr.title as string}</p>
          </div>
          {isManager && ncrStatus !== "closed" && ncrStatus !== "cancelled" && (
            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-500" onClick={() => setCancelDialogOpen(true)}>
              Cancel NCR
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Status transitions */}
        {transitions.length > 0 && (
          <div className="flex gap-2">
            {transitions.map(t => (
              <Button key={t.status} size="sm" onClick={() => transition(t.status)} disabled={transitioning}
                className={t.status === "closed" ? "bg-green-600 hover:bg-green-700" : ""}>
                {transitioning ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                {t.label}
              </Button>
            ))}
          </div>
        )}

        {/* Linked lot */}
        {!!ncr.lot_id && (
          <Link href={`/quality/lots/${ncr.lot_id as string}`}>
            <Card className="hover:border-border/80 cursor-pointer">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">Linked lot: </span>
                  <span className="font-mono font-semibold">{ncr.lot_number as string}</span>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Source: </span>{(ncr.source as string).replace(/_/g, " ")}</div>
              <div><span className="text-muted-foreground">Assigned to: </span>{(ncr.assigned_to_name as string) || "—"}</div>
              <div><span className="text-muted-foreground">Affected qty: </span>{ncr.affected_quantity_kg != null ? `${ncr.affected_quantity_kg} kg` : "—"}</div>
              <div><span className="text-muted-foreground">Due: </span>{ncr.due_date ? new Date(ncr.due_date as string).toLocaleDateString() : "—"}</div>
            </div>
            {!!ncr.description && <p className="text-sm">{ncr.description as string}</p>}
          </CardContent>
        </Card>

        {/* Investigation fields (manager only) */}
        {isManager && ncrStatus !== "open" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Investigation & Resolution</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Root Cause</Label>
                <Textarea value={editFields.rootCause} onChange={e => setEditFields(f => ({ ...f, rootCause: e.target.value }))} rows={2} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Root Cause Category</Label>
                <Input value={editFields.rootCauseCategory} onChange={e => setEditFields(f => ({ ...f, rootCauseCategory: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Corrective Action</Label>
                <Textarea value={editFields.correctiveAction} onChange={e => setEditFields(f => ({ ...f, correctiveAction: e.target.value }))} rows={2} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Preventive Action</Label>
                <Textarea value={editFields.preventiveAction} onChange={e => setEditFields(f => ({ ...f, preventiveAction: e.target.value }))} rows={2} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Disposition</Label>
                <select
                  value={editFields.dispositionAction}
                  onChange={e => setEditFields(f => ({ ...f, dispositionAction: e.target.value }))}
                  className="w-full border border-input bg-background text-sm rounded-md px-3 py-2 mt-1"
                >
                  <option value="">Select...</option>
                  {["reprocess", "downgrade", "reject_return", "use_as_is", "scrap"].map(v => (
                    <option key={v} value={v}>{v.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Activity Log */}
        <Card>
          <CardHeader><CardTitle className="text-base">Activity Log</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              {activities.map((a) => (
                <div key={a.id as string} className="border-l-2 border-border pl-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium">{a.action as string}</span>
                    {!!a.user_name && <span className="text-xs text-muted-foreground">by {a.user_name as string}</span>}
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(a.created_at as string).toLocaleString()}</span>
                  </div>
                  {!!a.notes && <p className="text-xs text-muted-foreground">{a.notes as string}</p>}
                </div>
              ))}
            </div>
            {ncrStatus !== "closed" && ncrStatus !== "cancelled" && (
              <div className="flex gap-2">
                <Textarea
                  value={activityNote}
                  onChange={e => setActivityNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1"
                />
                <Button size="sm" onClick={addActivity} disabled={addingNote || !activityNote.trim()} className="self-end">
                  {addingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancel NCR</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to cancel this NCR? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Keep NCR</Button>
            <Button variant="destructive" onClick={cancel}>Cancel NCR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
