import type { UserRole } from "./schemas";

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

// ─── Session Tokens ───

export interface SessionPayload {
  userId: string;
  role: UserRole;
  tenantId: string | null;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const raw = `${payload.userId}:${payload.role}:${payload.tenantId ?? ""}:${Date.now()}`;
  const payloadB64 = btoa(raw);
  const signature = await hmacSign(raw, SESSION_SECRET);
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return null;
    const raw = atob(payloadB64);
    const expected = await hmacSign(raw, SESSION_SECRET);
    if (expected !== signature) return null;

    const parts = raw.split(":");
    if (parts.length === 4) {
      // New format: userId:role:tenantId:timestamp
      const tenantId = parts[2] === "" ? null : parts[2];
      return { userId: parts[0], role: parts[1] as UserRole, tenantId };
    }
    if (parts.length === 3) {
      // Legacy 3-part format — treat as null tenant for 24h migration window
      return { userId: parts[0], role: parts[1] as UserRole, tenantId: null };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Password Hashing (PBKDF2, edge-compatible) ───

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [saltHex, hashHex] = hash.split(":");
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  const newHashHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return newHashHex === hashHex;
}
