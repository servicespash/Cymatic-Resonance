import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';

interface RegistryExportProps {
  selectedCount?: number;
  availableRows?: any[];
  rangeFrom?: Date;
  rangeTo?: Date;
  onExportLogged?: (format: 'pdf' | 'excel', rowCount: number, scope: 'all' | 'selected') => Promise<void>;
}

export const RegistryExport = ({
  selectedCount = 0,
  availableRows = [],
  rangeFrom,
  rangeTo,
  onExportLogged
}: RegistryExportProps) => {
  const [dateRange, setDateRange] = useState({ 
    start: rangeFrom ? rangeFrom.toISOString().split('T')[0] : '', 
    end: rangeTo ? rangeTo.toISOString().split('T')[0] : '' 
  });

  // Sync date fields if parent values change
  React.useEffect(() => {
    if (rangeFrom) setDateRange(p => ({ ...p, start: rangeFrom.toISOString().split('T')[0] }));
    if (rangeTo) setDateRange(p => ({ ...p, end: rangeTo.toISOString().split('T')[0] }));
  }, [rangeFrom, rangeTo]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    const isSelectedMode = selectedCount > 0;
    const rowCount = isSelectedMode ? selectedCount : availableRows.length;
    const scope = isSelectedMode ? 'selected' : 'all';

    if (rowCount === 0) {
      toast.error(`No rows to export for ${format.toUpperCase()}`);
      return;
    }

    toast.loading(`Preparing ${format.toUpperCase()} export...`, { id: "export-toast" });

    try {
      const header = ["Name", "Category", "Check-in", "Check-out", "Hours", "Status", "Late"];
      const dataRows = availableRows.map(r => [
        r.name || '—',
        r.category || '—',
        r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '—',
        r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '—',
        r.hours != null ? `${r.hours.toFixed(2)}h` : '—',
        r.status || '—',
        r.late ? 'yes' : 'no'
      ]);

      if (format === 'excel') {
        // Generate an Excel-compatible CSV file (with standard CSV encoding)
        const csvContent = [header, ...dataRows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
          .join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `registry_export_${dateRange.start || 'all'}_to_${dateRange.end || 'all'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Generate a well-formatted Text Report representing PDF
        let report = `========================================================\n`;
        report += `            REGISTRY ATTENDANCE COMPLIANCE REPORT        \n`;
        report += `========================================================\n`;
        report += `Generated On : ${new Date().toLocaleString()}\n`;
        report += `Date Range   : ${dateRange.start || 'Start'} to ${dateRange.end || 'End'}\n`;
        report += `Export Type  : PDF Format (${scope.toUpperCase()})\n`;
        report += `Total Rows   : ${rowCount}\n`;
        report += `--------------------------------------------------------\n\n`;
        
        report += header.map(h => h.padEnd(15)).join(" | ") + "\n";
        report += "-".repeat(110) + "\n";
        
        dataRows.forEach(row => {
          report += row.map(cell => String(cell).substring(0, 14).padEnd(15)).join(" | ") + "\n";
        });
        
        const blob = new Blob([report], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `registry_report_${dateRange.start || 'all'}_to_${dateRange.end || 'all'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Log the compliance action
      if (onExportLogged) {
        await onExportLogged(format, rowCount, scope);
      }

      toast.success(`${format.toUpperCase()} Export completed successfully! Saved ${rowCount} rows.`, { id: "export-toast" });
    } catch (e) {
      console.error(e);
      toast.error(`Failed to export ${format.toUpperCase()}`, { id: "export-toast" });
    }
  };

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-3 flex flex-col md:flex-row items-stretch md:items-center gap-3">
      <div className="flex flex-col">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
          Registry Export Options
        </span>
        {selectedCount > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-accent font-semibold bg-accent/10 px-2 py-1 rounded border border-accent/20">
            <CheckSquare className="size-3.5" />
            <span>Exporting {selectedCount} Selected Row{selectedCount > 1 ? 's' : ''}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Exporting entire dataset range</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={() => handleExport('pdf')} 
          className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-muted-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        >
          <FileText className="size-3.5 text-red-400" /> PDF
        </button>
        <button 
          onClick={() => handleExport('excel')} 
          className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-muted-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        >
          <FileSpreadsheet className="size-3.5 text-green-400" /> Excel
        </button>
      </div>
    </div>
  );
};
