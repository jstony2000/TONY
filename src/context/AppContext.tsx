import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '../lib/constants';

type AppState = {
  data: Record<string, number>;
  extras: Record<string, number>;
  config: Record<string, any>;
  patron: number[];
  start: string;
};

type AppContextType = {
  state: AppState;
  updateData: (date: string, type: number) => void;
  updateExtra: (date: string, hours: number) => void;
  updateConfig: (year: string, newConfig: any) => void;
  updatePatron: (index: number, value: number) => void;
  updateStart: (date: string) => void;
  applyPatron: (year: number, refMonday: Date) => void;
  resetYear: (year: number) => void;
  importData: (importedData: any) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    data: {},
    extras: {},
    config: {},
    patron: new Array(42).fill(0),
    start: '2026-01-01',
  });

  const [isLoaded, setIsLoaded] = useState(false);

  const importData = (importedData: any) => {
    const newState: Partial<AppState> = {};
    if (importedData.data || importedData.d) newState.data = importedData.data || importedData.d;
    if (importedData.extras || importedData.e) newState.extras = importedData.extras || importedData.e;
    if (importedData.patron) newState.patron = importedData.patron;
    if (importedData.start) newState.start = importedData.start;
    
    if (importedData.configAnual) {
      newState.config = importedData.configAnual;
    } else if (importedData.config) {
      if (importedData.config.salario !== undefined) {
        newState.config = { [new Date().getFullYear().toString()]: importedData.config };
      } else {
        newState.config = importedData.config;
      }
    }
    saveState(newState);
  };

  useEffect(() => {
    const loadData = async () => {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.DATA) || '{}');
      const extras = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXTRAS) || '{}');
      const patron = JSON.parse(localStorage.getItem(STORAGE_KEYS.PATRON) || `[${new Array(42).fill(0).join(',')}]`);
      const start = localStorage.getItem(STORAGE_KEYS.START) || '2026-01-01';
      
      let config = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG) || '{}');
      const currentYear = new Date().getFullYear().toString();
      
      if (config.salario !== undefined) {
        // Migrate old config format
        config = { [currentYear]: config };
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
      } else if (Object.keys(config).length === 0) {
        config = { [currentYear]: { ...DEFAULT_CONFIG } };
      }

      setState({ data, extras, config, patron, start });
      setIsLoaded(true);

      // Check cloud sync on mount
      try {
        const CLOUD_URL = 'https://jstony2000.github.io/TONY/nomina_backup.json';
        const res = await fetch(CLOUD_URL + '?t=' + Date.now());
        if (res.ok) {
          const cloudData = await res.json();
          const hasLocalData = Object.keys(data).length > 0;
          if (!hasLocalData || window.confirm("☁️ Hay una copia en la nube disponible.\n¿Deseas sobrescribir tus datos locales con los de GitHub?")) {
            importData(cloudData);
          }
        }
      } catch (e) {
        // Ignore fetch errors to prevent blocking
      }
    };

    loadData();
  }, []);

  const saveState = (newState: Partial<AppState>) => {
    setState(prev => {
      const updated = { ...prev, ...newState };
      if (newState.data) localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(updated.data));
      if (newState.extras) localStorage.setItem(STORAGE_KEYS.EXTRAS, JSON.stringify(updated.extras));
      if (newState.config) localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated.config));
      if (newState.patron) localStorage.setItem(STORAGE_KEYS.PATRON, JSON.stringify(updated.patron));
      if (newState.start) localStorage.setItem(STORAGE_KEYS.START, updated.start);
      return updated;
    });
  };

  const updateData = (date: string, type: number) => {
    const newData = { ...state.data };
    if (type === 0) {
      delete newData[date];
    } else {
      newData[date] = type;
    }
    saveState({ data: newData });
  };

  const updateExtra = (date: string, hours: number) => {
    const newExtras = { ...state.extras };
    if (hours === 0 || isNaN(hours)) {
      delete newExtras[date];
    } else {
      newExtras[date] = hours;
    }
    saveState({ extras: newExtras });
  };

  const updateConfig = (year: string, newConfig: any) => {
    saveState({ config: { ...state.config, [year]: newConfig } });
  };

  const updatePatron = (index: number, value: number) => {
    const newPatron = [...state.patron];
    newPatron[index] = value;
    saveState({ patron: newPatron });
  };

  const updateStart = (date: string) => {
    saveState({ start: date });
  };

  const applyPatron = (year: number, refMonday: Date) => {
    const newData = { ...state.data };
    // Remove existing data for the year
    Object.keys(newData).forEach(key => {
      if (key.startsWith(year.toString())) delete newData[key];
    });

    const d = new Date(year, 0, 1, 12, 0, 0);
    const end = new Date(year, 11, 31, 12, 0, 0);

    while (d <= end) {
      const diff = Math.round((d.getTime() - refMonday.getTime()) / 86400000);
      let pIdx = diff % 42;
      if (pIdx < 0) pIdx += 42;

      if (state.patron[pIdx] !== 1) {
        const w = d.getDay();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        newData[dateStr] = (w === 0 || w === 6) ? 2 : 1;
      }
      d.setDate(d.getDate() + 1);
    }
    saveState({ data: newData });
  };

  const resetYear = (year: number) => {
    const newData = { ...state.data };
    Object.keys(newData).forEach(key => {
      if (key.startsWith(year.toString())) delete newData[key];
    });
    saveState({ data: newData });
  };

  if (!isLoaded) return null;

  return (
    <AppContext.Provider value={{ state, updateData, updateExtra, updateConfig, updatePatron, updateStart, applyPatron, resetYear, importData }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
