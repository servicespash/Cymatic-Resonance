import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export const RegistryExport = () => {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const handleExport = (format: 'pdf' | 'excel') => {
    toast.success(`Exporting registry as ${format.toUpperCase()}...`);
    // Placeholder for actual export logic
  };

  return (
    <div className="bg-black/5 rounded-xl border border-white/5 p-4">
      <h3 className="font-semibold mb-3">Registry Export</h3>
      <div className="flex gap-2 mb-3">
        <input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({...p, start: e.target.value}))} className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm" />
        <input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({...p, end: e.target.value}))} className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => handleExport('pdf')} className="flex items-center gap-1 bg-frequency text-white px-3 py-2 rounded-lg text-sm"><Download className="size-4" /> PDF</button>
        <button onClick={() => handleExport('excel')} className="flex items-center gap-1 bg-frequency text-white px-3 py-2 rounded-lg text-sm"><Download className="size-4" /> Excel</button>
      </div>
    </div>
  );
};
