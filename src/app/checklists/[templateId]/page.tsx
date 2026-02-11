"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  ClipboardCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  checklistTypeLabels,
  itemTypeLabels,
  type ChecklistTemplate,
  type ChecklistType,
  type ItemResponse,
} from "@/lib/schemas";
import { ThemeToggle } from "@/components/theme-toggle";

interface ResponseState {
  checkboxValue?: boolean;
  passFail?: string;
  numericValue?: string;
  textValue?: string;
}

export default function FillChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as string;

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<string>("");
  const [responses, setResponses] = useState<Record<string, ResponseState>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Check authentication first
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push("/login?from=/checklists");
          return;
        }
        // User is authenticated, fetch templates
        return fetch(`/api/checklists/templates?active=true`);
      })
      .then((res) => {
        if (!res) return null;
        return res.json();
      })
      .then((data: ChecklistTemplate[] | null) => {
        if (!data) return;
        const found = data.find((t) => t.id === templateId);
        if (found) {
          setTemplate(found);
          // Initialize responses
          const initial: Record<string, ResponseState> = {};
          found.items.forEach((item) => {
            initial[item.id] = {
              checkboxValue: false,
              passFail: "",
              numericValue: "",
              textValue: "",
            };
          });
          setResponses(initial);
        }
      })
      .catch((error) => {
        console.error(error);
        router.push("/login?from=/checklists");
      })
      .finally(() => setLoading(false));
  }, [templateId, router]);

  const updateResponse = (
    itemId: string,
    field: keyof ResponseState,
    value: string | boolean
  ) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const handleSubmit = async () => {
    setError("");

    if (!shift) {
      setError("Please select your shift.");
      return;
    }
    if (!template) return;

    // Check required items
    for (const item of template.items) {
      if (!item.required) continue;
      const r = responses[item.id];
      if (!r) continue;

      if (item.type === "pass_fail" && !r.passFail) {
        setError(`Please complete required item: "${item.title}"`);
        return;
      }
      if (item.type === "numeric" && !r.numericValue) {
        setError(`Please complete required item: "${item.title}"`);
        return;
      }
      if (item.type === "text" && !r.textValue?.trim()) {
        setError(`Please complete required item: "${item.title}"`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const itemResponses: ItemResponse[] = template.items.map(
        (item) => {
          const r = responses[item.id];
          const resp: ItemResponse = {
            itemId: item.id,
            itemTitle: item.title,
            itemType: item.type,
          };
          if (item.type === "checkbox") resp.checkboxValue = r?.checkboxValue ?? false;
          if (item.type === "pass_fail") resp.passFail = r?.passFail as "pass" | "fail" | undefined;
          if (item.type === "numeric" && r?.numericValue)
            resp.numericValue = Number(r.numericValue);
          if (item.type === "text") resp.textValue = r?.textValue;
          return resp;
        }
      );

      const payload = {
        templateId: template.id,
        shift,
        responses: itemResponses,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/checklists/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to submit");

      const data = await res.json();
      setSubmissionId(data.submissionId);
      setSubmitted(true);
    } catch {
      setError("Failed to submit checklist. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">Checklist not found</p>
          <Link href="/checklists">
            <Button>Back to Checklists</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <CheckCircle2 size={56} className="mx-auto text-green-500" />
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Checklist Submitted!</h2>
              <p className="text-sm text-muted-foreground">
                {template.title}
              </p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Submission ID</p>
              <p className="font-mono font-bold text-lg">{submissionId}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Link href="/checklists" className="flex-1">
                <Button variant="outline" className="w-full">
                  Back to List
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button className="w-full">Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/checklists">
              <Button variant="ghost" size="icon">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                {template.title}
              </h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {checklistTypeLabels[template.type]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {template.items.length} items
                </span>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Worker Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Shift *</Label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day Shift</SelectItem>
                  <SelectItem value="night">Night Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Checklist Items */}
        <div className="space-y-3">
          {template.items.map((item, index) => (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">
                      {index + 1}. {item.title}
                      {item.required && (
                        <span className="text-red-400 ml-1">*</span>
                      )}
                    </p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {itemTypeLabels[item.type]}
                  </Badge>
                </div>

                {item.type === "checkbox" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={responses[item.id]?.checkboxValue ?? false}
                      onChange={(e) =>
                        updateResponse(item.id, "checkboxValue", e.target.checked)
                      }
                      className="rounded h-5 w-5"
                      id={`check_${item.id}`}
                    />
                    <Label
                      htmlFor={`check_${item.id}`}
                      className="text-sm cursor-pointer"
                    >
                      Done / Verified
                    </Label>
                  </div>
                )}

                {item.type === "pass_fail" && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        responses[item.id]?.passFail === "pass"
                          ? "default"
                          : "outline"
                      }
                      className={
                        responses[item.id]?.passFail === "pass"
                          ? "bg-green-600 hover:bg-green-700"
                          : ""
                      }
                      onClick={() =>
                        updateResponse(item.id, "passFail", "pass")
                      }
                    >
                      Pass
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        responses[item.id]?.passFail === "fail"
                          ? "default"
                          : "outline"
                      }
                      className={
                        responses[item.id]?.passFail === "fail"
                          ? "bg-red-600 hover:bg-red-700"
                          : ""
                      }
                      onClick={() =>
                        updateResponse(item.id, "passFail", "fail")
                      }
                    >
                      Fail
                    </Button>
                  </div>
                )}

                {item.type === "numeric" && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder={
                        item.numericMin !== undefined && item.numericMax !== undefined
                          ? `${item.numericMin} - ${item.numericMax}`
                          : "Enter value"
                      }
                      value={responses[item.id]?.numericValue ?? ""}
                      onChange={(e) =>
                        updateResponse(item.id, "numericValue", e.target.value)
                      }
                      className="w-32"
                    />
                    {item.unit && (
                      <span className="text-sm text-muted-foreground">
                        {item.unit}
                      </span>
                    )}
                    {(item.numericMin !== undefined ||
                      item.numericMax !== undefined) && (
                      <span className="text-xs text-muted-foreground">
                        (Range: {item.numericMin ?? "—"} to{" "}
                        {item.numericMax ?? "—"})
                      </span>
                    )}
                  </div>
                )}

                {item.type === "text" && (
                  <Textarea
                    placeholder="Enter your observation..."
                    value={responses[item.id]?.textValue ?? ""}
                    onChange={(e) =>
                      updateResponse(item.id, "textValue", e.target.value)
                    }
                    rows={2}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Notes */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs">Additional Notes (Optional)</Label>
            <Textarea
              placeholder="Any additional observations or comments..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        {/* Submit */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 animate-spin" size={18} />
              Submitting...
            </>
          ) : (
            <>
              <ClipboardCheck className="mr-2" size={18} />
              Submit Checklist
            </>
          )}
        </Button>
      </main>
    </div>
  );
}
