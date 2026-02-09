import { IncidentReport } from "./schemas";

// In-memory store (will be replaced with Vercel Postgres)
// Using globalThis to persist across hot reloads in development
const globalStore = globalThis as unknown as {
  __incidents?: IncidentReport[];
};

if (!globalStore.__incidents) {
  globalStore.__incidents = [];
}

export const incidents = globalStore.__incidents;
