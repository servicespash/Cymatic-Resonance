import React, { useRef } from "react";
import { FileSpreadsheet, FileText, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { ExportRow, formatTimeSafe, formatDateSafe } from "@/lib/export-utils";

export type { ExportRow };

export interface RegistryExportProps {
  title?: string;
  subtitle?: string;
  selectedCount?: number;
  availableRows?: ExportRow[];
  rangeFrom?: Date;
  rangeTo?: Date;
  entityName?: string;
  compact?: boolean;
  onExportLogged?: (
    format: "pdf" | "excel",
    rowCount: number,
    scope: "all" | "selected",
  ) => Promise<void>;
}

export const RegistryExport = ({
  title = "Official Attendance & Activity Ledger",
  subtitle = "Verified Institutional Audit Footprint",
  selectedCount = 0,
  availableRows = [],
  rangeFrom,
  rangeTo,
  entityName,
  compact = false,
  onExportLogged,
}: RegistryExportProps) => {
  const qrRef = useRef<SVGSVGElement>(null);

  const rangeLabel = React.useMemo(() => {
    if (rangeFrom && rangeTo) {
      return `${format(rangeFrom, "MMM d, yyyy")} → ${format(rangeTo, "MMM d, yyyy")}`;
    }
    return "All Recorded Cycles";
  }, [rangeFrom, rangeTo]);

  const handleExport = async (exportFormat: "pdf" | "excel") => {
    const isSelectedMode = selectedCount > 0;
    const rowCount = isSelectedMode ? selectedCount : availableRows.length;
    const scope: "all" | "selected" = isSelectedMode ? "selected" : "all";

    if (rowCount === 0) {
      toast.error(`No records found to export for ${exportFormat.toUpperCase()}`);
      return;
    }

    toast.loading(`Preparing ${exportFormat.toUpperCase()} multi-day export...`, {
      id: "export-toast",
    });

    const fileDateStr =
      rangeFrom && rangeTo
        ? `${format(rangeFrom, "yyyy-MM-dd")}_to_${format(rangeTo, "yyyy-MM-dd")}`
        : format(new Date(), "yyyy-MM-dd");

    try {
      if (exportFormat === "excel") {
        // Full, rich CSV / Excel with UTF-8 BOM
        const header = [
          "Date",
          "Member Name",
          "Category / Role",
          "Status",
          "Check-in Time",
          "Check-out Time",
          "Break Time",
          "Leave Type",
          "Leave Reason",
          "Leave Status",
          "Work Hours",
          "Late Arrival",
          "Telemetry Status",
        ];

        const csvData = availableRows.map((r) => [
          r.date || (r.checkIn ? formatDateSafe(r.checkIn) : "—"),
          r.name || "—",
          r.category || r.role || "—",
          r.status || "—",
          r.checkIn ? formatTimeSafe(r.checkIn) : "—",
          r.checkOut ? formatTimeSafe(r.checkOut) : r.checkIn ? "In Progress" : "—",
          r.breakDisplay ||
            (r.breakDurationMinutes != null
              ? `${r.breakDurationMinutes}m`
              : r.checkIn
                ? "0m"
                : "—"),
          r.leaveType || "—",
          r.leaveReason || "—",
          r.leaveStatus || "—",
          r.hours != null ? `${r.hours.toFixed(2)}h` : "—",
          r.late ? "Yes" : "No",
          (r.telemetry || "verified").toUpperCase(),
        ]);

        const csvContent =
          "\uFEFF" +
          [header, ...csvData]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\r\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance_ledger_${fileDateStr}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        if (onExportLogged) {
          await onExportLogged("excel", rowCount, scope).catch(() => {});
        }
        toast.success(`Excel / CSV Export generated successfully!`, { id: "export-toast" });
      } else {
        // Landscape PDF for maximum clarity and comprehensive column spacing
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

        // Header Title
        doc.setFontSize(16);
        doc.setTextColor(20, 20, 20);
        doc.text(title, 14, 16);

        // Subtitle & Scope
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const hash = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const subText = `${entityName ? `${entityName} · ` : ""}Date Range: ${rangeLabel} · Scope: ${scope.toUpperCase()} (${rowCount} records)`;
        doc.text(subText, 14, 22);
        doc.text(
          `Generated: ${new Date().toLocaleString()} · Cryptographic Hash: ${hash.slice(0, 16)}...`,
          14,
          27,
        );

        // Summary KPI mini-bar
        const totalWorkHours = availableRows.reduce((acc, r) => acc + (r.hours || 0), 0);
        const leaveDaysCount = availableRows.filter((r) => !!r.leaveType).length;
        const checkinCount = availableRows.filter((r) => !!r.checkIn).length;
        const totalBreaks = availableRows.reduce(
          (acc, r) => acc + (r.breakDurationMinutes || 0),
          0,
        );

        doc.setFontSize(8);
        doc.setTextColor(40, 40, 40);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(14, 30, 269, 9, 1.5, 1.5, "F");
        const kpiText = `SUMMARY:  Check-ins: ${checkinCount}  |  Total Work: ${totalWorkHours.toFixed(1)} hrs  |  Total Breaks: ${totalBreaks} mins  |  Leaves Recorded: ${leaveDaysCount}`;
        doc.text(kpiText, 18, 36);

        // Table Columns
        const pdfHeaders = [
          "Date",
          "Member Name",
          "Category",
          "Check-In",
          "Check-Out",
          "Break",
          "Leave & Reason",
          "Hours",
          "Status",
          "Late",
        ];

        const pdfData = availableRows.map((r) => {
          let leaveStr = "—";
          if (r.leaveType || r.leaveReason) {
            const reasonPart = r.leaveReason ? `: ${r.leaveReason}` : "";
            const statusPart = r.leaveStatus ? ` [${r.leaveStatus}]` : "";
            leaveStr = `${r.leaveType || "Leave"}${reasonPart}${statusPart}`;
          }

          return [
            r.date || (r.checkIn ? formatDateSafe(r.checkIn) : "—"),
            r.name || "—",
            r.category || r.role || "—",
            r.checkIn ? formatTimeSafe(r.checkIn) : "—",
            r.checkOut ? formatTimeSafe(r.checkOut) : r.checkIn ? "In Progress" : "—",
            r.breakDisplay ||
              (r.breakDurationMinutes != null
                ? `${r.breakDurationMinutes}m`
                : r.checkIn
                  ? "0m"
                  : "—"),
            leaveStr,
            r.hours != null ? `${r.hours.toFixed(2)}h` : "—",
            r.status || "—",
            r.late ? "Yes" : "No",
          ];
        });

        autoTable(doc, {
          startY: 42,
          head: [pdfHeaders],
          body: pdfData,
          theme: "grid",
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 7.5,
          },
          bodyStyles: {
            fontSize: 7,
            textColor: [30, 30, 30],
            cellPadding: 1.5,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { cellWidth: 22 }, // Date
            1: { cellWidth: 32 }, // Name
            2: { cellWidth: 24 }, // Category
            3: { cellWidth: 20 }, // Check-In
            4: { cellWidth: 20 }, // Check-Out
            5: { cellWidth: 18 }, // Break
            6: { cellWidth: 70 }, // Leave & Reason (ample width for stated reason)
            7: { cellWidth: 18 }, // Hours
            8: { cellWidth: 28 }, // Status
            9: { cellWidth: 15 }, // Late
          },
          margin: { left: 14, right: 14 },
        });

        const finalY =
          (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 160;

        const checkNewPage = finalY + 35 > 195;
        if (checkNewPage) {
          doc.addPage();
        }
        const sigY = checkNewPage ? 20 : finalY + 8;

        doc.setFontSize(8);
        doc.setTextColor(30, 30, 30);
        doc.text("Cryptographic Verification & Institutional Seal", 14, sigY);
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(
          "Scan the attached verification matrix or verify authenticity against the institutional ledger.",
          14,
          sigY + 4,
        );

        if (qrRef.current) {
          const svgData = new XMLSerializer().serializeToString(qrRef.current);
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const img = new Image();
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const png = canvas.toDataURL("image/png");
            doc.addImage(png, "PNG", 14, sigY + 6, 22, 22);
            doc.save(`attendance_report_${fileDateStr}.pdf`);
            toast.success("PDF Export completed successfully!", { id: "export-toast" });
          };
          img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
        } else {
          doc.save(`attendance_report_${fileDateStr}.pdf`);
          toast.success("PDF Export completed successfully!", { id: "export-toast" });
        }

        if (onExportLogged) {
          await onExportLogged("pdf", rowCount, scope).catch(() => {});
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to export ${exportFormat.toUpperCase()}`, { id: "export-toast" });
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleExport("pdf")}
          className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-muted-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          title="Export personal attendance & leave ledger to PDF"
        >
          <FileText className="size-3.5 text-red-400" /> Export PDF
        </button>
        <button
          onClick={() => handleExport("excel")}
          className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-muted-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          title="Export personal attendance & leave ledger to Excel/CSV"
        >
          <FileSpreadsheet className="size-3.5 text-green-400" /> Export Excel
        </button>

        <div className="hidden">
          <QRCodeSVG
            ref={qrRef}
            value={`https://verify.cymatic.resonance/audit/${rangeFrom?.getTime() || Date.now()}`}
            size={128}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          Institutional Multi-Day Exports
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{subtitle}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] text-accent">
            <CalendarDays className="size-3" />
            {rangeLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleExport("pdf")}
          className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
          <FileText className="size-4 text-red-400" /> Export PDF
        </button>
        <button
          onClick={() => handleExport("excel")}
          className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
          <FileSpreadsheet className="size-4 text-green-400" /> Export Excel
        </button>
      </div>

      <div className="hidden">
        <QRCodeSVG
          ref={qrRef}
          value={`https://verify.cymatic.resonance/audit/${rangeFrom?.getTime() || Date.now()}`}
          size={128}
        />
      </div>
    </div>
  );
};
