"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ClipboardList, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  checklistTypeLabels,
  type ChecklistTemplate,
  type ChecklistType,
} from "@/lib/schemas";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ChecklistsPage() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/checklists/templates?active=true")
      .then((res) => res.json())
      .then((data) => setTemplates(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Group templates by type
  const grouped = templates.reduce<Record<string, ChecklistTemplate[]>>(
    (acc, t) => {
      if (!acc[t.type]) acc[t.type] = [];
      acc[t.type].push(t);
      return acc;
    },
    {}
  );

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
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
              <ClipboardList className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Checklists</h1>
              <p className="text-xs text-muted-foreground">
                Select a checklist to fill
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
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No checklists available</p>
            <p className="text-sm">
              Ask your admin to create checklist templates.
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                {checklistTypeLabels[type as ChecklistType]}
              </h2>
              <div className="space-y-2">
                {items.map((t) => (
                  <Link key={t.id} href={`/checklists/${t.id}`}>
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">{t.title}</p>
                          {t.description && (
                            <p className="text-sm text-muted-foreground">
                              {t.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {t.items.length} items
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight
                          size={20}
                          className="text-muted-foreground"
                        />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
