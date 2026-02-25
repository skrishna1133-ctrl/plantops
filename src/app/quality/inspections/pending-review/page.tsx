"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ClipboardList, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PendingReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
      fetch("/api/qms/inspections/pending-review").then(r => r.json()).then(d => {
        setItems(Array.isArray(d) ? d : []);
      }).finally(() => setLoading(false));
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <h1 className="font-bold">Pending Review</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList size={32} className="mx-auto mb-3 opacity-40" />
            <p>No inspections pending review</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(i => (
              <Link key={i.id as string} href={`/quality/inspections/${i.id as string}`}>
                <Card className="hover:border-border/80 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-mono font-semibold">{i.lot_number as string}</p>
                      <p className="text-xs text-muted-foreground">By {i.inspected_by_name as string} · {new Date(i.submitted_at as string).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
