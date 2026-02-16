"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, FlaskConical, ChevronRight, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { QualityDocument, QualityDocumentV2 } from "@/lib/schemas";
import { ThemeToggle } from "@/components/theme-toggle";
import QualityDocDialog from "@/components/admin/quality-doc-dialog";
import CreateQualityDocV2Dialog from "@/components/admin/create-quality-doc-v2-dialog";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  worker_filled: "Worker Filled",
  complete: "Complete",
};

const statusColors: Record<string, string> = {
  draft: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  worker_filled: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  complete: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function LabDashboard() {
  const [docs, setDocs] = useState<QualityDocument[]>([]);
  const [v2Docs, setV2Docs] = useState<QualityDocumentV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createV2Open, setCreateV2Open] = useState(false);
  const router = useRouter();

  const fetchDocs = useCallback(async () => {
    try {
      const [legacyRes, v2Res] = await Promise.all([
        fetch("/api/quality"),
        fetch("/api/quality/v2"),
      ]);
      const legacyData = await legacyRes.json();
      const v2Data = await v2Res.json();
      setDocs(legacyData);
      setV2Docs(Array.isArray(v2Data) ? v2Data : []);
    } catch (error) {
      console.error("Error fetching docs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => setUserName(data.fullName || ""))
      .catch(() => {});
    fetchDocs();
  }, [fetchDocs]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  // Legacy docs
  const workerFilledDocs = docs.filter((d) => d.status === "worker_filled");
  const draftDocs = docs.filter((d) => d.status === "draft");
  const completeDocs = docs.filter((d) => d.status === "complete");

  // V2 docs
  const v2WorkerFilledDocs = v2Docs.filter((d) => d.status === "worker_filled");
  const v2DraftDocs = v2Docs.filter((d) => d.status === "draft");
  const v2CompleteDocs = v2Docs.filter((d) => d.status === "complete");

  const totalReadyForAnalysis = workerFilledDocs.length + v2WorkerFilledDocs.length;
  const hasAnyDocs = docs.length > 0 || v2Docs.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
              <FlaskConical className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Lab Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                {userName ? `Hi, ${userName}` : "Quality & metal contamination analysis"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-red-400"
            >
              <LogOut size={14} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-2">
          <Button onClick={() => setCreateV2Open(true)} className="flex-1">
            <Plus size={16} className="mr-2" />
            New Quality Document
          </Button>
          <Button onClick={() => setCreateOpen(true)} variant="outline" className="flex-1">
            <Plus size={16} className="mr-2" />
            Legacy Document
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : !hasAnyDocs ? (
          <div className="text-center py-16 text-muted-foreground">
            <FlaskConical size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No quality documents yet</p>
            <p className="text-sm">Create one using the button above.</p>
          </div>
        ) : (
          <>
            {/* Ready for Analysis - V2 */}
            {v2WorkerFilledDocs.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Ready for Analysis ({totalReadyForAnalysis})
                </h2>
                <div className="space-y-2">
                  {v2WorkerFilledDocs.map((d) => (
                    <Link key={d.id} href={`/quality/v2/${d.id}`}>
                      <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-2 border-amber-500/30">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">{d.templateTitle}</p>
                            <p className="text-sm text-muted-foreground">{d.docId}</p>
                            <div className="flex items-center gap-2">
                              <Badge className={statusColors[d.status]}>
                                {statusLabels[d.status]}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {d.rowCount} rows
                              </Badge>
                              {d.workerName && (
                                <span className="text-xs text-muted-foreground">
                                  by {d.workerName}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-muted-foreground" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Ready for Analysis - Legacy */}
            {workerFilledDocs.length > 0 && (
              <div className="space-y-2">
                {v2WorkerFilledDocs.length === 0 && (
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Ready for Analysis ({totalReadyForAnalysis})
                  </h2>
                )}
                <div className="space-y-2">
                  {workerFilledDocs.map((d) => (
                    <Link key={d.id} href={`/lab/${d.id}`}>
                      <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-2 border-amber-500/30">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">PO: {d.poNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {d.materialCode} — {d.customerName}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge className={statusColors[d.status]}>
                                {statusLabels[d.status]}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {d.rowCount} gaylords
                              </Badge>
                              {d.personName && (
                                <span className="text-xs text-muted-foreground">
                                  by {d.personName}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-muted-foreground" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Draft - Pending Worker Fill */}
            {(v2DraftDocs.length > 0 || draftDocs.length > 0) && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Draft — Pending Worker Fill ({v2DraftDocs.length + draftDocs.length})
                </h2>
                <div className="space-y-2">
                  {v2DraftDocs.map((d) => (
                    <Card key={d.id} className="opacity-70">
                      <CardContent className="p-4">
                        <div className="space-y-1">
                          <p className="font-medium">{d.templateTitle}</p>
                          <p className="text-sm text-muted-foreground">{d.docId}</p>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColors[d.status]}>
                              {statusLabels[d.status]}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {d.rowCount} rows
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {draftDocs.map((d) => (
                    <Card key={d.id} className="opacity-70">
                      <CardContent className="p-4">
                        <div className="space-y-1">
                          <p className="font-medium">PO: {d.poNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {d.materialCode} — {d.customerName}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColors[d.status]}>
                              {statusLabels[d.status]}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {d.rowCount} gaylords
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {(v2CompleteDocs.length > 0 || completeDocs.length > 0) && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Completed ({v2CompleteDocs.length + completeDocs.length})
                </h2>
                <div className="space-y-2">
                  {v2CompleteDocs.map((d) => (
                    <Link key={d.id} href={`/quality/v2/${d.id}`}>
                      <Card className="opacity-50 hover:opacity-70 transition-opacity cursor-pointer">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">{d.templateTitle}</p>
                            <p className="text-sm text-muted-foreground">{d.docId}</p>
                            <div className="flex items-center gap-2">
                              <Badge className={statusColors[d.status]}>
                                {statusLabels[d.status]}
                              </Badge>
                              {d.workerName && (
                                <span className="text-xs text-muted-foreground">
                                  by {d.workerName}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-muted-foreground" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                  {completeDocs.map((d) => (
                    <Card key={d.id} className="opacity-50">
                      <CardContent className="p-4">
                        <div className="space-y-1">
                          <p className="font-medium">PO: {d.poNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {d.materialCode} — {d.customerName}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColors[d.status]}>
                              {statusLabels[d.status]}
                            </Badge>
                            {d.personName && (
                              <span className="text-xs text-muted-foreground">
                                by {d.personName}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <QualityDocDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchDocs}
      />

      <CreateQualityDocV2Dialog
        open={createV2Open}
        onOpenChange={setCreateV2Open}
        onCreated={fetchDocs}
      />
    </div>
  );
}
