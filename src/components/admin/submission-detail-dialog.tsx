"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  checklistTypeLabels,
  itemTypeLabels,
  type ChecklistSubmission,
} from "@/lib/schemas";
import { CheckCircle2, XCircle, Minus } from "lucide-react";

interface SubmissionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: ChecklistSubmission | null;
}

export default function SubmissionDetailDialog({
  open,
  onOpenChange,
  submission,
}: SubmissionDetailDialogProps) {
  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{submission.templateTitle}</span>
            <Badge variant="outline" className="text-xs">
              {submission.submissionId}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Submitted by {submission.personName} &middot;{" "}
            {submission.shift === "day" ? "Day" : "Night"} Shift &middot;{" "}
            {new Date(submission.submittedAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          <div className="flex gap-2 text-sm">
            <Badge variant="secondary">
              {checklistTypeLabels[submission.templateType]}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-3">
            {submission.responses.map((r, i) => (
              <div
                key={r.itemId}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border"
              >
                <span className="text-xs text-muted-foreground font-mono mt-0.5">
                  {i + 1}.
                </span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.itemTitle}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {itemTypeLabels[r.itemType]}
                    </Badge>
                  </div>
                  <div className="text-sm">
                    {r.itemType === "checkbox" && (
                      <div className="flex items-center gap-1">
                        {r.checkboxValue ? (
                          <CheckCircle2 size={16} className="text-green-500" />
                        ) : (
                          <XCircle size={16} className="text-red-400" />
                        )}
                        <span>{r.checkboxValue ? "Checked" : "Not checked"}</span>
                      </div>
                    )}
                    {r.itemType === "pass_fail" && (
                      <div className="flex items-center gap-1">
                        {r.passFail === "pass" ? (
                          <CheckCircle2 size={16} className="text-green-500" />
                        ) : r.passFail === "fail" ? (
                          <XCircle size={16} className="text-red-400" />
                        ) : (
                          <Minus size={16} className="text-muted-foreground" />
                        )}
                        <span className="capitalize">{r.passFail || "N/A"}</span>
                      </div>
                    )}
                    {r.itemType === "numeric" && (
                      <span className="font-mono">
                        {r.numericValue !== undefined ? r.numericValue : "N/A"}
                      </span>
                    )}
                    {r.itemType === "text" && (
                      <span>{r.textValue || "N/A"}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {submission.notes && (
            <>
              <Separator />
              <div className="space-y-1">
                <span className="text-sm font-medium">Notes</span>
                <p className="text-sm text-muted-foreground">
                  {submission.notes}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
