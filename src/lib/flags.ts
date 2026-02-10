import type { ChecklistSubmission } from "@/lib/schemas";

export function getFlags(sub: ChecklistSubmission): string[] {
  const flags: string[] = [];
  for (const r of sub.responses) {
    if (r.itemType === "checkbox" && r.checkboxValue === false) {
      flags.push(`${r.itemTitle}: Not checked`);
    }
    if (r.itemType === "pass_fail" && r.passFail === "fail") {
      flags.push(`${r.itemTitle}: Failed`);
    }
    if (r.itemType === "numeric" && r.numericValue !== undefined) {
      if (r.numericMin !== undefined && r.numericValue < r.numericMin) {
        flags.push(`${r.itemTitle}: ${r.numericValue} below min ${r.numericMin}${r.numericUnit ? " " + r.numericUnit : ""}`);
      }
      if (r.numericMax !== undefined && r.numericValue > r.numericMax) {
        flags.push(`${r.itemTitle}: ${r.numericValue} above max ${r.numericMax}${r.numericUnit ? " " + r.numericUnit : ""}`);
      }
    }
  }
  return flags;
}
