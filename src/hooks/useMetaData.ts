import { useEffect } from "react";

interface MetaData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export const useMetaData = (meta: MetaData) => {
  useEffect(() => {
    if (meta.title) {
      document.title = meta.title;
      // Update OG title
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", meta.title);
      // Update Twitter title
      const twitterTitle = document.querySelector('meta[name="twitter:title"]');
      if (twitterTitle) twitterTitle.setAttribute("content", meta.title);
    }

    if (meta.description) {
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", meta.description);
      // Update OG desc
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", meta.description);
      // Update Twitter desc
      const twitterDesc = document.querySelector('meta[name="twitter:description"]');
      if (twitterDesc) twitterDesc.setAttribute("content", meta.description);
    }

    if (meta.image) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) ogImage.setAttribute("content", meta.image);
      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (twitterImage) twitterImage.setAttribute("content", meta.image);
    }
  }, [meta]);
};
