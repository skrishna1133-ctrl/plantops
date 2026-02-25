"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, FileCheck2, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Coa {
  id: string;
  coa_number: string;
  lot_number: string;
  customer_name?: string;
  material_type?: string;
  issued_at: string;
  pdf_url?: string;
}

export default function CoaListPage() {
  const router = useRouter();
  const [coas, setCoas] = useState<Coa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
    });
    fetch("/api/qms/coas").then(r => r.json()).then(d => {
      setCoas(Array.isArray(d) ? d : []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div className="flex-1">
            <h1 className="font-bold">Certificates of Analysis</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : coas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileCheck2 size={32} className="mx-auto mb-3 opacity-40" />
            <p>No COAs issued yet</p>
            <p className="text-sm mt-1">Approve lots and generate COAs from the lot detail page</p>
          </div>
        ) : (
          <div className="space-y-2">
            {coas.map(c => (
              <Card key={c.id} className="hover:border-border/80">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-semibold">{c.coa_number}</span>
                      <Badge variant="outline" className="text-xs font-mono">{c.lot_number}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.customer_name && <span>{c.customer_name} · </span>}
                      {c.material_type && <span>{c.material_type} · </span>}
                      <span>Issued {new Date(c.issued_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/quality/coa/${c.id}`}>
                      <Button size="sm" variant="outline">View</Button>
                    </Link>
                    <a href={`/api/qms/coas/${c.id}/pdf`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">
                        <Download size={14} className="mr-1" /> PDF
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
