"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LogResponse {
  id: string; fieldId: string; fieldLabel?: string; fieldUnit?: string;
  value: string; isOutOfRange: boolean;
}
interface LogSubmission {
  id: string; templateTitle?: string; machineName?: string;
  submittedByName?: string; signedOffByName?: string;
  signedOffAt: string | null; notes: string | null; submittedAt: string;
  responses?: LogResponse[];
}

export default function LogSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submission, setSubmission] = useState<LogSubmission | null>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingOff, setSigningOff] = useState(false);

  const isManager = ["maintenance_manager", "engineer", "admin", "owner"].includes(role);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      setRole(d.role);
      fetch(`/api/maintenance/log-submissions/${id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { setSubmission(data); setLoading(false); });
    });
  }, [id, router]);

  const signOff = async () => {
    setSigningOff(true);
    const res = await fetch(`/api/maintenance/log-submissions/${id}/signoff`, { method: "POST" });
    if (res.ok) {
      const updated = await fetch(`/api/maintenance/log-submissions/${id}`);
      if (updated.ok) setSubmission(await updated.json());
    }
    setSigningOff(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!submission) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Submission not found</div>;

  const outOfRangeCount = (submission.responses || []).filter(r => r.isOutOfRange).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance/log-sheets"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <div>
              <h1 className="text-lg font-bold">{submission.templateTitle || "Log Sheet Submission"}</h1>
              <p className="text-xs text-muted-foreground">
                {submission.machineName} • {submission.submittedByName} •{" "}
                {new Date(submission.submittedAt).toLocaleString()}
              </p>
            </div>
          </div>
          {isManager && !submission.signedOffAt && (
            <Button size="sm" onClick={signOff} disabled={signingOff}>
              {signingOff ? "Signing off..." : "Sign Off"}
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status */}
        <Card>
          <CardContent className="p-4">
            {submission.signedOffAt ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 size={16} />
                <p className="text-sm font-medium">
                  Signed off by {submission.signedOffByName} on{" "}
                  {new Date(submission.signedOffAt).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle size={16} />
                <p className="text-sm">Pending manager sign-off</p>
              </div>
            )}
          </CardContent>
        </Card>

        {outOfRangeCount > 0 && (
          <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              {outOfRangeCount} value(s) outside expected range.
            </p>
          </div>
        )}

        {/* Responses */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Logged Values</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border">
            {(submission.responses || []).map((r, i) => (
              <div key={r.id} className={`py-3 flex items-center justify-between ${r.isOutOfRange ? "bg-orange-500/5 -mx-6 px-6" : ""}`}>
                <div>
                  <p className="text-sm font-medium">
                    {i + 1}. {r.fieldLabel || `Field ${i + 1}`}
                    {r.fieldUnit && <span className="text-muted-foreground ml-1">({r.fieldUnit})</span>}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{r.value || "—"}</p>
                </div>
                {r.isOutOfRange && <Badge variant="destructive" className="text-xs shrink-0">Out of Range</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>

        {submission.notes && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-1">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.notes}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
