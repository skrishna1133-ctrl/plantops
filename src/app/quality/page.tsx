"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, FileCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { QualityDocument } from "@/lib/schemas";
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
  const [docs, setDocs] = useState<QualityDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quality")
      .then((res) => res.json())
      .then((data) => setDocs(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const draftDocs = docs.filter((d) => d.status === "draft");
  const otherDocs = docs.filter((d) => d.status !== "draft");

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
              <h1 className="text-xl font-bold tracking-tight">Quality</h1>
              <p className="text-xs text-muted-foreground">
                Quality inspection documents
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : draftDocs.length === 0 && otherDocs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileCheck size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No quality documents</p>
            <p className="text-sm">Ask your admin to create one.</p>
          </div>
        ) : (
          <>
            {draftDocs.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Pending — Fill These
                </h2>
                <div className="space-y-2">
                  {draftDocs.map((d) => (
                    <Link key={d.id} href={`/quality/${d.id}`}>
                      <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-2 border-blue-500/30">
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
                                {d.rowCount} drums
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

            {otherDocs.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Previously Submitted
                </h2>
                <div className="space-y-2">
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
