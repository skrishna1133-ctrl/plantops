"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ChecklistResponse {
  id: string; itemId: string; itemLabel?: string; value: string; isFlagged: boolean;
}
interface ChecklistSubmission {
  id: string; templateTitle?: string; machineName?: string; submittedByName?: string;
  hasFlags: boolean; notes: string | null; submittedAt: string;
  responses?: ChecklistResponse[];
}

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submission, setSubmission] = useState<ChecklistSubmission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      fetch(`/api/maintenance/checklist-submissions/${id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { setSubmission(data); setLoading(false); });
    });
  }, [id, router]);

  const formatValue = (value: string) => {
    if (value === "true") return "✓ Checked";
    if (value === "false") return "✗ Not checked";
    return value;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!submission) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Submission not found</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/maintenance/checklists"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
          <div>
            <h1 className="text-lg font-bold">{submission.templateTitle || "Checklist Submission"}</h1>
            <p className="text-xs text-muted-foreground">
              {submission.machineName} • {submission.submittedByName} •{" "}
              {new Date(submission.submittedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {submission.hasFlags && (
          <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              This submission has flagged items that require attention.
            </p>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Responses</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border">
            {(submission.responses || []).map((r, i) => (
              <div key={r.id} className={`py-3 flex items-start justify-between ${r.isFlagged ? "bg-orange-500/5 -mx-6 px-6" : ""}`}>
                <div>
                  <p className="text-sm font-medium">
                    {i + 1}. {r.itemLabel || `Item ${i + 1}`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{formatValue(r.value)}</p>
                </div>
                {r.isFlagged && <Badge variant="destructive" className="text-xs shrink-0">Flagged</Badge>}
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
