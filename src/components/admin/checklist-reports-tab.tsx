"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Download,
  AlertCircle,
  Calendar,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  checklistTypeLabels,
  itemTypeLabels,
  type ChecklistType,
  type ChecklistSubmission,
  type ItemResponse,
} from "@/lib/schemas";

interface FlaggedSubmission extends ChecklistSubmission {
  flags: string[];
}

interface DailyReport {
  mode: "daily";
  date: string;
  totalSubmissions: number;
  flaggedCount: number;
  cleanCount: number;
  flaggedSubmissions: FlaggedSubmission[];
}

interface WeeklyReport {
  mode: "weekly";
  weekOf: string;
  weekEnd: string;
  totalSubmissions: number;
  totalFlagged: number;
  totalClean: number;
  flaggedByDay: Record<string, number>;
  totalByDay: Record<string, number>;
  flaggedByType: Record<string, number>;
  topIssues: { issue: string; count: number }[];
}

type ReportView = "daily" | "weekly";

export default function ChecklistReportsTab() {
  const [view, setView] = useState<ReportView>("daily");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedWeek, setSelectedWeek] = useState(() => getMondayStr(new Date()));
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [view, selectedDate, selectedWeek]);

  async function fetchReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (view === "daily") {
        params.set("mode", "daily");
        params.set("date", selectedDate);
      } else {
        params.set("mode", "weekly");
        params.set("weekOf", selectedWeek);
      }
      const res = await fetch(`/api/checklists/reports?${params}`);
      const data = await res.json();
      if (view === "daily") setDailyReport(data);
      else setWeeklyReport(data);
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCleanup() {
    if (
      !confirm(
        "This will permanently remove all non-flagged submissions older than 7 days. Continue?"
      )
    )
      return;
    setCleaning(true);
    try {
      const res = await fetch("/api/checklists/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup" }),
      });
      const data = await res.json();
      alert(`Cleanup complete: ${data.removedCount} submissions removed.`);
      fetchReport();
    } catch (error) {
      console.error("Cleanup error:", error);
    } finally {
      setCleaning(false);
    }
  }

  function navigateDate(direction: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + direction);
    setSelectedDate(d.toISOString().slice(0, 10));
  }

  function navigateWeek(direction: number) {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() + direction * 7);
    setSelectedWeek(d.toISOString().slice(0, 10));
  }

  async function exportDailyPdf() {
    if (!dailyReport || dailyReport.flaggedCount === 0) return;

    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("PlantOps - Daily Flagged Report", 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${dailyReport.date}`, 14, 28);
    doc.text(
      `Total: ${dailyReport.totalSubmissions} | Flagged: ${dailyReport.flaggedCount} | Clean: ${dailyReport.cleanCount}`,
      14,
      34
    );

    doc.setDrawColor(200);
    doc.line(14, 38, pageWidth - 14, 38);

    let yPos = 44;

    for (const sub of dailyReport.flaggedSubmissions) {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${sub.submissionId} - ${sub.templateTitle}`, 14, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Person: ${sub.personName} | Shift: ${sub.shift} | Type: ${checklistTypeLabels[sub.templateType]} | Time: ${new Date(sub.submittedAt).toLocaleTimeString()}`,
        14,
        yPos
      );
      yPos += 4;

      // Flags
      doc.setTextColor(220, 50, 50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      for (const flag of sub.flags) {
        doc.text(`  ⚠ ${flag}`, 14, yPos);
        yPos += 4;
      }
      doc.setTextColor(0, 0, 0);

      // Responses table
      const tableData = sub.responses.map((r: ItemResponse) => {
        let value = "";
        if (r.itemType === "checkbox") value = r.checkboxValue ? "Yes" : "No";
        else if (r.itemType === "pass_fail") value = r.passFail || "N/A";
        else if (r.itemType === "numeric")
          value =
            r.numericValue !== undefined
              ? `${r.numericValue}${r.numericUnit ? " " + r.numericUnit : ""}`
              : "N/A";
        else if (r.itemType === "text") value = r.textValue || "N/A";

        const isFlagged = sub.flags.some((f: string) =>
          f.startsWith(r.itemTitle + ":")
        );
        return [r.itemTitle, itemTypeLabels[r.itemType], value, isFlagged ? "⚠" : "✓"];
      });

      autoTable(doc, {
        startY: yPos,
        head: [["Item", "Type", "Value", ""]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [60, 60, 60] },
        columnStyles: { 3: { halign: "center", cellWidth: 12 } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: function (data: any) {
          if (
            data.section === "body" &&
            data.column.index === 3 &&
            data.cell.text[0] === "⚠"
          ) {
            data.cell.styles.textColor = [220, 50, 50];
          }
        },
      });

      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      if (sub.notes) {
        doc.setFontSize(8);
        doc.text(`Notes: ${sub.notes}`, 14, yPos);
        yPos += 6;
      }

      doc.setDrawColor(220);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 6;
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Generated: ${new Date().toLocaleString()} | PlantOps`,
      14,
      doc.internal.pageSize.getHeight() - 10
    );

    doc.save(`plantops-daily-report-${dailyReport.date}.pdf`);
  }

  async function exportWeeklyPdf() {
    if (!weeklyReport) return;

    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("PlantOps - Weekly Summary", 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Week: ${weeklyReport.weekOf} to ${weeklyReport.weekEnd}`,
      14,
      28
    );
    doc.text(
      `Total Submissions: ${weeklyReport.totalSubmissions} | Flagged: ${weeklyReport.totalFlagged} | Clean: ${weeklyReport.totalClean}`,
      14,
      34
    );

    // Daily breakdown table
    const days = Object.keys(weeklyReport.totalByDay).sort();
    const dayData = days.map((d) => [
      d,
      String(weeklyReport.totalByDay[d] || 0),
      String(weeklyReport.flaggedByDay[d] || 0),
      String(
        (weeklyReport.totalByDay[d] || 0) -
          (weeklyReport.flaggedByDay[d] || 0)
      ),
    ]);

    autoTable(doc, {
      startY: 42,
      head: [["Date", "Total", "Flagged", "Clean"]],
      body: dayData,
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [60, 60, 60] },
    });

    let yPos =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;

    // Flags by type
    if (Object.keys(weeklyReport.flaggedByType).length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Flagged by Checklist Type", 14, yPos);
      yPos += 6;

      const typeData = Object.entries(weeklyReport.flaggedByType).map(
        ([type, count]) => [
          checklistTypeLabels[type as ChecklistType] || type,
          String(count),
        ]
      );

      autoTable(doc, {
        startY: yPos,
        head: [["Type", "Flagged Count"]],
        body: typeData,
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [60, 60, 60] },
      });

      yPos =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 10;
    }

    // Top issues
    if (weeklyReport.topIssues.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Top Issues", 14, yPos);
      yPos += 6;

      autoTable(doc, {
        startY: yPos,
        head: [["Issue", "Occurrences"]],
        body: weeklyReport.topIssues.map((i) => [i.issue, String(i.count)]),
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [60, 60, 60] },
      });
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Generated: ${new Date().toLocaleString()} | PlantOps`,
      14,
      doc.internal.pageSize.getHeight() - 10
    );

    doc.save(
      `plantops-weekly-summary-${weeklyReport.weekOf}.pdf`
    );
  }

  return (
    <div className="space-y-4">
      {/* View Toggle + Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={view === "daily" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("daily")}
          >
            Daily Report
          </Button>
          <Button
            variant={view === "weekly" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("weekly")}
          >
            Weekly Summary
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {view === "daily" ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateDate(-1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-muted-foreground" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border border-border rounded px-2 py-1 text-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateDate(1)}
              >
                <ChevronRight size={16} />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateWeek(-1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-medium">
                Week of {selectedWeek}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateWeek(1)}
              >
                <ChevronRight size={16} />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {view === "daily" && dailyReport && dailyReport.flaggedCount > 0 && (
            <Button size="sm" variant="outline" onClick={exportDailyPdf}>
              <Download size={14} className="mr-1" />
              Export PDF
            </Button>
          )}
          {view === "weekly" && weeklyReport && (
            <>
              <Button size="sm" variant="outline" onClick={exportWeeklyPdf}>
                <Download size={14} className="mr-1" />
                Export PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-400 hover:text-red-300"
                onClick={handleCleanup}
                disabled={cleaning}
              >
                {cleaning ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <Trash2 size={14} className="mr-1" />
                )}
                Cleanup Old
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : view === "daily" && dailyReport ? (
        <DailyReportView report={dailyReport} />
      ) : view === "weekly" && weeklyReport ? (
        <WeeklyReportView report={weeklyReport} />
      ) : null}
    </div>
  );
}

function DailyReportView({ report }: { report: DailyReport }) {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{report.totalSubmissions}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">
              {report.flaggedCount}
            </p>
            <p className="text-xs text-muted-foreground">Flagged</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">
              {report.cleanCount}
            </p>
            <p className="text-xs text-muted-foreground">Clean</p>
          </CardContent>
        </Card>
      </div>

      {report.flaggedCount === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No flagged submissions</p>
          <p className="text-sm">All checklists passed for {report.date}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {report.flaggedSubmissions.map((sub) => (
            <Card
              key={sub.id}
              className="border-red-500/20 bg-red-500/5"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-500" />
                    {sub.templateTitle}
                    <Badge variant="outline" className="text-[10px]">
                      {sub.submissionId}
                    </Badge>
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    {checklistTypeLabels[sub.templateType]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {sub.personName} &middot; {sub.shift} shift &middot;{" "}
                  {new Date(sub.submittedAt).toLocaleTimeString()}
                </p>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {/* Flags summary */}
                <div className="space-y-1">
                  {sub.flags.map((flag, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-red-400"
                    >
                      <AlertCircle size={12} />
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* All responses */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Value</TableHead>
                        <TableHead className="text-xs w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sub.responses.map((r) => {
                        const isFlagged = sub.flags.some((f) =>
                          f.startsWith(r.itemTitle + ":")
                        );
                        return (
                          <TableRow
                            key={r.itemId}
                            className={isFlagged ? "bg-red-500/10" : ""}
                          >
                            <TableCell className="text-xs font-medium">
                              {r.itemTitle}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {itemTypeLabels[r.itemType]}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatValue(r)}
                            </TableCell>
                            <TableCell className="text-xs text-center">
                              {isFlagged && (
                                <AlertCircle
                                  size={14}
                                  className="text-red-500"
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {sub.notes && (
                  <p className="text-xs text-muted-foreground">
                    Notes: {sub.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WeeklyReportView({ report }: { report: WeeklyReport }) {
  const days = Object.keys(report.totalByDay).sort();

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{report.totalSubmissions}</p>
            <p className="text-xs text-muted-foreground">Total This Week</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">
              {report.totalFlagged}
            </p>
            <p className="text-xs text-muted-foreground">Flagged</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">
              {report.totalClean}
            </p>
            <p className="text-xs text-muted-foreground">Clean</p>
          </CardContent>
        </Card>
      </div>

      {report.totalSubmissions === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No submissions this week</p>
        </div>
      ) : (
        <>
          {/* Daily Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Flagged</TableHead>
                    <TableHead className="text-center">Clean</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {days.map((day) => {
                    const total = report.totalByDay[day] || 0;
                    const flagged = report.flaggedByDay[day] || 0;
                    return (
                      <TableRow
                        key={day}
                        className={flagged > 0 ? "bg-red-500/5" : ""}
                      >
                        <TableCell className="font-medium">{day}</TableCell>
                        <TableCell className="text-center">{total}</TableCell>
                        <TableCell className="text-center">
                          {flagged > 0 ? (
                            <span className="text-red-400 font-medium">
                              {flagged}
                            </span>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {total - flagged}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Flags by Type */}
          {Object.keys(report.flaggedByType).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Flagged by Checklist Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(report.flaggedByType).map(([type, count]) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className="border-red-500/30 text-red-400"
                    >
                      {checklistTypeLabels[type as ChecklistType] || type}:{" "}
                      {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Issues */}
          {report.topIssues.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Top Recurring Issues
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue</TableHead>
                      <TableHead className="text-center w-24">
                        Occurrences
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.topIssues.map((issue, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-400 shrink-0" />
                          {issue.issue}
                        </TableCell>
                        <TableCell className="text-center font-medium text-red-400">
                          {issue.count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function formatValue(r: ItemResponse): string {
  if (r.itemType === "checkbox") return r.checkboxValue ? "Yes" : "No";
  if (r.itemType === "pass_fail")
    return r.passFail ? r.passFail.charAt(0).toUpperCase() + r.passFail.slice(1) : "N/A";
  if (r.itemType === "numeric")
    return r.numericValue !== undefined
      ? `${r.numericValue}${r.numericUnit ? " " + r.numericUnit : ""}`
      : "N/A";
  if (r.itemType === "text") return r.textValue || "N/A";
  return "N/A";
}

function getMondayStr(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}
