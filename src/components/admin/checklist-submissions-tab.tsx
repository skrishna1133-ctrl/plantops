"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Loader2, Eye, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  checklistTypes,
  checklistTypeLabels,
  type ChecklistSubmission,
} from "@/lib/schemas";
import { getFlags } from "@/lib/flags";
import SubmissionDetailDialog from "./submission-detail-dialog";

export default function ChecklistSubmissionsTab() {
  const [submissions, setSubmissions] = useState<ChecklistSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterShift, setFilterShift] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] =
    useState<ChecklistSubmission | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filterFlags, setFilterFlags] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterShift !== "all") params.set("shift", filterShift);
      const res = await fetch(`/api/checklists/submissions?${params}`);
      const data = await res.json();
      setSubmissions(data);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterShift]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const deleteSubmission = async (id: string) => {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/checklists/submissions/${id}`, { method: "DELETE" });
      fetchSubmissions();
    } catch (error) {
      console.error("Error deleting submission:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const openDetail = (sub: ChecklistSubmission) => {
    setSelectedSubmission(sub);
    setDetailOpen(true);
  };

  const displayedSubmissions = submissions.filter((s) => {
    if (filterFlags === "all") return true;
    const hasFlags = getFlags(s).length > 0;
    return filterFlags === "flagged" ? hasFlags : !hasFlags;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {checklistTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {checklistTypeLabels[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterShift} onValueChange={setFilterShift}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Filter by shift" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shifts</SelectItem>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="night">Night</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterFlags} onValueChange={setFilterFlags}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Flags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="flagged">Flagged Only</SelectItem>
            <SelectItem value="clean">Clean Only</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{displayedSubmissions.length} submissions</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : displayedSubmissions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No submissions yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-center">Flags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedSubmissions.map((s) => {
                const flags = getFlags(s);
                return (
                <TableRow key={s.id} className={flags.length > 0 ? "bg-red-500/5" : ""}>
                  <TableCell className="font-mono text-xs">
                    {s.submissionId}
                  </TableCell>
                  <TableCell className="font-medium">
                    {s.templateTitle}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {checklistTypeLabels[s.templateType]}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.personName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {s.shift}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(s.submittedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {flags.length > 0 ? (
                      <div className="flex items-center justify-center gap-1" title={flags.join("\n")}>
                        <AlertCircle size={16} className="text-red-500" />
                        <span className="text-xs font-medium text-red-500">{flags.length}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openDetail(s)}
                      >
                        <Eye size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                        onClick={() => deleteSubmission(s.id)}
                        disabled={deletingId === s.id}
                      >
                        {deletingId === s.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <SubmissionDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        submission={selectedSubmission}
      />
    </div>
  );
}
