"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, FileCheck, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { QualityDocument, QualityDocumentV2 } from "@/lib/schemas";
import { ThemeToggle } from "@/components/theme-toggle";

const statusLabels: Record<string, string> = {
  draft: "To Fill",
  worker_filled: "Submitted",
  complete: "Complete",
};

const statusColors: Record<string, string> = {
  draft: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  worker_filled: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  complete: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function QualityPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<QualityDocument[]>([]);
  const [v2Docs, setV2Docs] = useState<QualityDocumentV2[]>([]);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push("/login?from=/quality");
          return;
        }
        setUserName(data.fullName || "");
        return Promise.all([
          fetch("/api/quality").then((r) => r.json()),
          fetch("/api/quality/v2").then((r) => r.json()),
        ]);
      })
      .then((results) => {
        if (results) {
          setDocs(results[0]);
          setV2Docs(Array.isArray(results[1]) ? results[1] : []);
        }
      })
      .catch((error) => {
        console.error(error);
        router.push("/login?from=/quality");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  const draftDocs = docs.filter((d) => d.status === "draft");
  const otherDocs = docs.filter((d) => d.status !== "draft");

  const v2DraftDocs = v2Docs.filter((d) => d.status === "draft");
  const v2OtherDocs = v2Docs.filter((d) => d.status !== "draft");

  const hasNoContent =
    draftDocs.length === 0 &&
    otherDocs.length === 0 &&
    v2DraftDocs.length === 0 &&
    v2OtherDocs.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
              <FileCheck className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Quality Inspection</h1>
              <p className="text-xs text-muted-foreground">
                {userName ? `Hi, ${userName} — ` : ""}Fill quality documents
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
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : hasNoContent ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileCheck size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No quality documents</p>
            <p className="text-sm">Ask your admin to create one.</p>
          </div>
        ) : (
          <>
            {/* V2 Draft Docs - Pending Fill */}
            {v2DraftDocs.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Pending — Fill These
                </h2>
                <div className="space-y-2">
                  {v2DraftDocs.map((d) => (
                    <Link key={d.id} href={`/quality/v2/${d.id}`}>
                      <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-2 border-blue-500/30">
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

            {/* Legacy Draft Docs */}
            {draftDocs.length > 0 && (
              <div className="space-y-2">
                {v2DraftDocs.length === 0 && (
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Pending — Fill These
                  </h2>
                )}
                <div className="space-y-2">
                  {draftDocs.map((d) => (
                    <Link key={d.id} href={`/quality/${d.id}`}>
                      <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-2 border-blue-500/30">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">Bulk Density & Metal Contamination Report</p>
                            <p className="text-sm text-muted-foreground">
                              PO: {d.poNumber} — {d.materialCode} — {d.customerName}
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
                          <ChevronRight size={20} className="text-muted-foreground" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Previously Submitted */}
            {(v2OtherDocs.length > 0 || otherDocs.length > 0) && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Previously Submitted
                </h2>
                <div className="space-y-2">
                  {v2OtherDocs.map((d) => (
                    <Link key={d.id} href={`/quality/v2/${d.id}`}>
                      <Card className="opacity-60 hover:opacity-80 transition-opacity cursor-pointer">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">{d.templateTitle}</p>
                            <p className="text-sm text-muted-foreground">{d.docId}</p>
                            <div className="flex items-center gap-2">
                              <Badge className={statusColors[d.status]}>
                                {statusLabels[d.status]}
                              </Badge>
                              {d.workerName && (
                                <span className="text-xs text-muted-foreground">by {d.workerName}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-muted-foreground" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                  {otherDocs.map((d) => (
                    <Card key={d.id} className="opacity-60">
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
                              <span className="text-xs text-muted-foreground">by {d.personName}</span>
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
    </div>
  );
}
