const SESSION_SECRET =
  process.env.SESSION_SECRET || "plantops-default-secret-change-in-prod";

async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(): Promise<string> {
  const payload = `admin:${Date.now()}`;
  const payloadB64 = btoa(payload);
  const signature = await hmacSign(payload, SESSION_SECRET);
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return false;
    const payload = atob(payloadB64);
    const expected = await hmacSign(payload, SESSION_SECRET);
    return expected === signature;
  } catch {
    return false;
  }
}
