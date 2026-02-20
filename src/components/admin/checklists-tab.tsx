"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import ChecklistTemplatesTab from "./checklist-templates-tab";
import ChecklistSubmissionsTab from "./checklist-submissions-tab";
import ChecklistReportsTab from "./checklist-reports-tab";

type SubTab = "templates" | "submissions" | "reports";

export default function ChecklistsTab({ readOnly = false, viewAs }: { readOnly?: boolean; viewAs?: string }) {
  const [subTab, setSubTab] = useState<SubTab>(readOnly ? "submissions" : "templates");

  const tabs: { id: SubTab; label: string }[] = [
    ...(!readOnly ? [{ id: "templates" as SubTab, label: "Templates" }] : []),
    { id: "submissions", label: "Submissions" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border pb-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={subTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setSubTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {subTab === "templates" && !readOnly && <ChecklistTemplatesTab viewAs={viewAs} />}
      {subTab === "submissions" && <ChecklistSubmissionsTab readOnly={readOnly} viewAs={viewAs} />}
      {subTab === "reports" && <ChecklistReportsTab />}
    </div>
  );
}
