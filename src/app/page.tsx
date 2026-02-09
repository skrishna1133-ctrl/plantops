"use client";

import { useState } from "react";
import { AlertTriangle, Wrench, ClipboardCheck, Package, Clock, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import IncidentReportDialog from "@/components/incident-report-dialog";

const tools = [
  {
    id: "incident-report",
    name: "Report Incident",
    description: "Report safety incidents, equipment issues, or quality concerns",
    icon: AlertTriangle,
    color: "text-red-500",
    bgColor: "bg-red-500/10 hover:bg-red-500/20",
    available: true,
  },
  {
    id: "maintenance",
    name: "Maintenance Request",
    description: "Submit equipment maintenance and repair requests",
    icon: Wrench,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
    available: false,
  },
  {
    id: "safety-checklist",
    name: "Safety Checklist",
    description: "Complete daily safety inspection checklists",
    icon: ClipboardCheck,
    color: "text-green-500",
    bgColor: "bg-green-500/10 hover:bg-green-500/20",
    available: false,
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "Track equipment and materials inventory",
    icon: Package,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
    available: false,
  },
  {
    id: "downtime",
    name: "Downtime Tracker",
    description: "Log and monitor production downtime events",
    icon: Clock,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10 hover:bg-amber-500/20",
    available: false,
  },
  {
    id: "shift-handover",
    name: "Shift Handover",
    description: "Document shift handover notes and updates",
    icon: FileText,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10 hover:bg-cyan-500/20",
    available: false,
  },
];

export default function Home() {
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);

  const handleToolClick = (toolId: string) => {
    if (toolId === "incident-report") {
      setIncidentDialogOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">PlantOps</h1>
            <p className="text-xs text-muted-foreground">Manufacturing Operations Suite</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-1">Tools</h2>
          <p className="text-muted-foreground">Select a tool to get started</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card
                key={tool.id}
                className={`cursor-pointer transition-all duration-200 border-border ${
                  tool.available
                    ? `${tool.bgColor} border-2`
                    : "opacity-50 cursor-not-allowed"
                }`}
                onClick={() => tool.available && handleToolClick(tool.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`${tool.color} mt-1`}>
                      <Icon size={28} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{tool.name}</h3>
                        {!tool.available && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Incident Report Dialog */}
      <IncidentReportDialog
        open={incidentDialogOpen}
        onOpenChange={setIncidentDialogOpen}
      />
    </div>
  );
}
