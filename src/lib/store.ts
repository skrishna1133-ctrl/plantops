import { IncidentReport, ChecklistTemplate, ChecklistSubmission } from "./schemas";

// In-memory store (will be replaced with Vercel Postgres)
// Using globalThis to persist across hot reloads in development
const globalStore = globalThis as unknown as {
  __incidents?: IncidentReport[];
  __checklistTemplates?: ChecklistTemplate[];
  __checklistSubmissions?: ChecklistSubmission[];
};

if (!globalStore.__incidents) {
  globalStore.__incidents = [];
}
if (!globalStore.__checklistTemplates) {
  globalStore.__checklistTemplates = [];
}
if (!globalStore.__checklistSubmissions) {
  globalStore.__checklistSubmissions = [];
}

export const incidents = globalStore.__incidents;
export const checklistTemplates = globalStore.__checklistTemplates;
export const checklistSubmissions = globalStore.__checklistSubmissions;
