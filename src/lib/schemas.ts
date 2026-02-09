import { z } from "zod";

export const incidentReportSchema = z.object({
  reporterName: z.string().min(2, "Name must be at least 2 characters"),
  plant: z.enum(["plant-a", "plant-b"], {
    message: "Please select a plant",
  }),
  category: z.enum(["safety", "equipment", "quality", "environmental"], {
    message: "Please select a category",
  }),
  description: z.string().min(10, "Description must be at least 10 characters"),
  criticality: z.enum(["minor", "major", "critical"], {
    message: "Please select criticality level",
  }),
  incidentDate: z.string().min(1, "Please provide the incident date and time"),
});

export type IncidentReportInput = z.infer<typeof incidentReportSchema>;

export interface IncidentReport extends IncidentReportInput {
  id: string;
  ticketId: string;
  status: "open" | "in_progress" | "resolved";
  photoUrl?: string;
  createdAt: string;
}
