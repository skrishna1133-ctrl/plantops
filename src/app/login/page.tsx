"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  useEffect(() => {
    // Redirect to home page (which is now the login page)
    // Preserve the 'from' parameter if present
    const target = from ? `/?from=${encodeURIComponent(from)}` : "/";
    router.replace(target);
  }, [router, from]);

  return (
    <div className="flex items-center justify-center">
      <Loader2 className="animate-spin text-muted-foreground" size={32} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      }>
        <LoginRedirect />
      </Suspense>
    </div>
  );
}
