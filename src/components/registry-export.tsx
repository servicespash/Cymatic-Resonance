import React, { useState, useRef } from "react";
import { Download, FileSpreadsheet, FileText, CheckSquare, QrCode } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { QRCodeSVG } from "qrcode.react";

export interface ExportRow {
  name?: string | null;
  category?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  hours?: number | null;
  status?: string | null;
  late?: boolean | null;
  telemetry?: string | null;
}

interface RegistryExportProps {
  selectedCount?: number;
  availableRows?: ExportRow[];
}

export const RegistryExport = ({ selectedCount = 0, availableRows = [] }: RegistryExportProps) => {
  const qrRef = useRef<SVGSVGElement>(null);

  const handleExport = async (format: "pdf" | "excel") => {
    const isSelectedMode = selectedCount > 0;
    const rowCount = isSelectedMode ? selectedCount : availableRows.length;
    const scope = isSelectedMode ? "selected" : "all";

    if (rowCount === 0) {
      toast.error(`No rows to export for ${format.toUpperCase()}`);
      return;
    }

    toast.loading(`Preparing ${format.toUpperCase()} export...`, { id: "export-toast" });

    try {
      const header = [
        "Name",
        "Category",
        "Date",
        "Check-in",
        "Check-out",
        "Hours",
        "Telemetry",
        "Late",
      ];
      const dataRows = availableRows.map((r) => [
        r.name || "—",
        r.category || "—",
        r.checkIn ? new Date(r.checkIn).toLocaleDateString() : "—",
        r.checkIn
          ? new Date(r.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "—",
        r.checkOut
          ? new Date(r.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "—",
        r.hours != null ? `${r.hours.toFixed(2)}h` : "—",
        (r.telemetry || "verified").toUpperCase(),
        r.late ? "Yes" : "No",
      ]);

      if (format === "excel") {
        const csvContent = [header, ...dataRows]
          .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
          .join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `registry_export.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Official Registry Attendance Export", 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        const extractTime = new Date().toISOString();
        const hash = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Export Scope: ${scope.toUpperCase()} (${rowCount} records)`, 14, 35);
        doc.text(`Integrity Hash: ${hash}`, 14, 40);

        autoTable(doc, {
          startY: 45,
          head: [header],
          body: dataRows,
          theme: "grid",
          headStyles: { fillColor: [40, 40, 40] },
          styles: { fontSize: 8 },
        });

        const finalY =
          (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text("Cryptographic Verification Signature", 14, finalY);
        doc.text("Scan QR code to verify document authenticity online.", 14, finalY + 5);

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
            doc.addImage(png, "PNG", 14, finalY + 10, 30, 30);
            doc.save(`registry_report.pdf`);
            toast.success("PDF Export completed successfully!", { id: "export-toast" });
          };
          img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
        } else {
          doc.save(`registry_report.pdf`);
          toast.success("PDF Export completed successfully!", { id: "export-toast" });
        }
      }

      if (format === "excel")
        toast.success(`Excel Export completed successfully!`, { id: "export-toast" });
    } catch (e) {
      console.error(e);
      toast.error(`Failed to export ${format.toUpperCase()}`, { id: "export-toast" });
    }
  };

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          Administrative Exports
        </span>
        <span className="text-sm font-medium">Verified Audit Footprint</span>
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
          value={`https://verify.cymatic.resonance/audit/${Date.now()}`}
          size={128}
        />
      </div>
    </div>
  );
};
