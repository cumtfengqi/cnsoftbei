import React, { createContext, useContext, useCallback, useRef } from 'react';

interface PageState {
  [key: string]: any;
}

interface PageCacheContextType {
  getState: (pageKey: string) => any;
  setState: (pageKey: string, state: any) => void;
  clearState: (pageKey: string) => void;
}

const PageCacheContext = createContext<PageCacheContextType | null>(null);

export const PageCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cacheRef = useRef<PageState>({});

  const getState = useCallback((pageKey: string) => {
    return cacheRef.current[pageKey];
  }, []);

  const setState = useCallback((pageKey: string, state: any) => {
    cacheRef.current[pageKey] = state;
  }, []);

  const clearState = useCallback((pageKey: string) => {
    delete cacheRef.current[pageKey];
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
