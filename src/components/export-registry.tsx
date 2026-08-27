import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileDown } from "lucide-react";

export const ExportRegistry = () => {
  const [loading, setLoading] = useState(false);

  const exportData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('full_name, role, org_id'); // Example registry query
      if (error) throw error;
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + ["Name,Role,OrgID"].concat(data.map(e => `${e.full_name},${e.role},${e.org_id}`)).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "registry_export.csv");
      document.body.appendChild(link);
      link.click();
      toast.success("Export successful");
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={exportData}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs"
    >
      <FileDown className="size-4" />
      {loading ? "Exporting..." : "Export Registry"}
    </button>
  );
};
