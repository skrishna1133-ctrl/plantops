"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RedirectToLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin";

  useEffect(() => {
    router.replace(`/login?from=${encodeURIComponent(from)}`);
  }, [router, from]);

  return null;
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <RedirectToLogin />
    </Suspense>
  );
}
