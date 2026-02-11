"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Wrench, ClipboardCheck, Package, Clock, FileText, Shield, FileCheck, LogIn, FlaskConical, Eye, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import IncidentReportDialog from "@/components/incident-report-dialog";
import { ThemeToggle } from "@/components/theme-toggle";

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
    id: "checklists",
    name: "Checklists",
    description: "Complete shift, safety, quality, and maintenance checklists",
    icon: ClipboardCheck,
    color: "text-green-500",
    bgColor: "bg-green-500/10 hover:bg-green-500/20",
    available: true,
  },
  {
    id: "quality",
    name: "Quality",
    description: "Fill quality inspection documents for shipments",
    icon: FileCheck,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
    available: true,
  },
  {
    id: "shipments",
    name: "Shipments",
    description: "Track incoming and outgoing shipments",
    icon: Package,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10 hover:bg-indigo-500/20",
    available: true,
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

const roleDashboards: Record<string, { href: string; label: string; icon: typeof Shield }> = {
  admin: { href: "/admin", label: "Admin", icon: Shield },
  owner: { href: "/admin", label: "Admin", icon: Shield },
  lab_tech: { href: "/lab", label: "Lab", icon: FlaskConical },
  engineer: { href: "/view", label: "View", icon: Eye },
  shipping: { href: "/shipments", label: "Shipments", icon: Package },
  worker: { href: "/quality", label: "Quality", icon: FileCheck },
};

export default function Home() {
  const router = useRouter();
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.authenticated) {
          setAuthenticated(true);
          setUserRole(data.role);
        } else {
          setAuthenticated(false);
        }
      })
      .catch(() => {
        setAuthenticated(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleToolClick = (toolId: string) => {
    if (toolId === "incident-report") {
      setIncidentDialogOpen(true);
    } else if (toolId === "checklists") {
      router.push("/checklists");
    } else if (toolId === "quality") {
      router.push("/quality");
    } else if (toolId === "shipments") {
      router.push("/shipments");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  // Landing page for unauthenticated users
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="fixed top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="text-center space-y-6 max-w-2xl">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-20 h-20 rounded-2xl bg-orange-500 flex items-center justify-center">
              <span className="text-white font-bold text-4xl">P</span>
            </div>
          </div>
          <h1 className="text-5xl font-bold tracking-tight">PlantOps</h1>
          <p className="text-xl text-muted-foreground">
            Manufacturing Operations Suite
          </p>
          <p className="text-muted-foreground max-w-md mx-auto">
            Streamline your plant operations with integrated tools for incident reporting, quality control, checklists, and shipment tracking.
          </p>
          <div className="pt-6">
            <Link href="/login">
              <Button size="lg" className="text-lg px-8 py-6">
                <LogIn size={20} className="mr-2" />
                Login to Continue
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated home page with tools
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">PlantOps</h1>
              <p className="text-xs text-muted-foreground">Manufacturing Operations Suite</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {userRole && roleDashboards[userRole] ? (() => {
              const dash = roleDashboards[userRole];
              const DashIcon = dash.icon;
              return (
                <Link href={dash.href}>
                  <Button variant="outline" size="sm">
                    <DashIcon size={14} className="mr-2" />
                    Dashboard
                  </Button>
                </Link>
              );
            })() : null}
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
