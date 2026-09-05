import React, { useEffect } from "react";

interface MetaData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export const useMetaData = (meta: MetaData) => {
  useEffect(() => {
    if (meta.title) document.title = meta.title;
    if (meta.description) {
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", meta.description);
    }
    // Update OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && meta.title) ogTitle.setAttribute("content", meta.title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && meta.description) ogDesc.setAttribute("content", meta.description);

    // Similarly update other tags as needed
  }, [meta]);
};
