/**
 * Vitest setup file — runs once before all tests.
 * Loads .env.test, initialises all DB tables.
 */
import { config } from "dotenv";
import path from "path";
import { beforeAll } from "vitest";

// Load test environment variables before anything else
config({ path: path.resolve(process.cwd(), ".env.test") });

// Polyfill Web Crypto for Node environments that need it
if (typeof globalThis.crypto === "undefined") {
  const { webcrypto } = await import("node:crypto");
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

beforeAll(async () => {
  // Import after env vars are loaded so DB connection string is available
  const { initDb } = await import("@/lib/db");
  await initDb();
}, 60_000);
