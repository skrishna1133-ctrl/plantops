"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import ShipmentsTab from "@/components/admin/shipments-tab";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ShipmentsPage() {
  const [userName, setUserName] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => setUserName(data.fullName || ""))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Package className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Shipments</h1>
              <p className="text-xs text-muted-foreground">
                {userName ? `Hi, ${userName} — ` : ""}Track incoming & outgoing shipments
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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <ShipmentsTab />
      </main>
    </div>
  );
}
