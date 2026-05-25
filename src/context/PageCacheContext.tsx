import React, { createContext, useContext, useCallback, useRef } from 'react';

interface PageState {
  [key: string]: any;
}

interface PageCacheContextType {
  getState: (pageKey: string) => any;
  setState: (pageKey: string, state: any) => void;
  clearState: (pageKey: string) => void;
}

const SESSION_KEY_PREFIX = 'page_cache_';

const PageCacheContext = createContext<PageCacheContextType | null>(null);

export const PageCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cacheRef = useRef<PageState>({});

  const getState = useCallback((pageKey: string) => {
    if (cacheRef.current[pageKey] !== undefined) {
      return cacheRef.current[pageKey];
    }
    try {
      const stored = sessionStorage.getItem(SESSION_KEY_PREFIX + pageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        cacheRef.current[pageKey] = parsed;
        return parsed;
      }
    } catch {}
    return undefined;
  }, []);

  const setState = useCallback((pageKey: string, state: any) => {
    cacheRef.current[pageKey] = state;
    try {
      sessionStorage.setItem(SESSION_KEY_PREFIX + pageKey, JSON.stringify(state));
    } catch {}
  }, []);

  const clearState = useCallback((pageKey: string) => {
    delete cacheRef.current[pageKey];
    try {
      sessionStorage.removeItem(SESSION_KEY_PREFIX + pageKey);
    } catch {}
  }, []);

  return (
    <PageCacheContext.Provider value={{ getState, setState, clearState }}>
      {children}
    </PageCacheContext.Provider>
  );
};

export const usePageCache = (pageKey: string) => {
  const context = useContext(PageCacheContext);
  if (!context) {
    throw new Error('usePageCache must be used within PageCacheProvider');
  }

  const { getState, setState } = context;

  const cachedState = getState(pageKey);

  const saveState = (state: any) => {
    setState(pageKey, state);
  };

  return { cachedState, saveState };
};
