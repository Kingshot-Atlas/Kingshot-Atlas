import { useEffect } from 'react';

const BASE_TITLE = 'Kingshot Atlas';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
    
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}

export function setDocumentTitle(title?: string) {
  document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
}
