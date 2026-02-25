"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LabPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/quality");
  }, []);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="animate-spin text-muted-foreground" size={28} />
    </div>
  );
}
