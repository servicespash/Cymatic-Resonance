import React, { useState } from "react";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface SessionData {
  timestamp: string;
  interaction: string;
}

interface FrequencyData {
  value: number;
  type: string;
}

interface ExportSessionReportProps {
  sessionData: SessionData[];
  frequencies: FrequencyData[];
}

export const ExportSessionReport = ({ sessionData, frequencies }: ExportSessionReportProps) => {
  const [loading, setLoading] = useState(false);

  const exportPDF = async () => {
    setLoading(true);
    try {
      const doc = new jsPDF() as jsPDF & {
        autoTable: (options: Record<string, unknown>) => void;
        lastAutoTable: { finalY: number };
      };

      // Title
      doc.setFontSize(18);
      doc.text("Cymatic Resonance Session Report", 14, 22);

      // Meta
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

      // Interaction History
      doc.setFontSize(14);
      doc.text("Interaction History", 14, 40);

      // Example Table using jspdf-autotable
      doc.autoTable({
        startY: 45,
        head: [["Timestamp", "Interaction"]],
        body: sessionData.map((s) => [s.timestamp, s.interaction]),
      });

      // Generated Frequencies
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text("Generated Frequencies", 14, finalY);

      doc.autoTable({
        startY: finalY + 5,
        head: [["Frequency (Hz)", "Type"]],
        body: frequencies.map((f) => [f.value.toString(), f.type]),
      });

      doc.save("session_report.pdf");
      toast.success("PDF Report Export successful");
    } catch (e) {
      console.error(e);
      toast.error("PDF Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={exportPDF}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 rounded-lg text-xs font-semibold text-accent transition-colors"
    >
      <FileDown className="size-4" />
      {loading ? "Generating PDF..." : "Export Session Report"}
    </button>
  );
};
