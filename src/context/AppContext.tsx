import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '../lib/constants';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, query, writeBatch } from 'firebase/firestore';

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
  const { user } = useAuth();
  const [state, setState] = useState<AppState>({
    data: {},
    extras: {},
    config: {},
    patron: new Array(42).fill(0),
    start: '2026-01-01',
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState<any>(null);

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

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    const loadLocal = () => {
      let data = {}, extras = {}, patron = new Array(42).fill(0), start = '2026-01-01', config: any = {};
      try {
        data = JSON.parse(localStorage.getItem(STORAGE_KEYS.DATA) || '{}') || {};
        extras = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXTRAS) || '{}') || {};
        patron = JSON.parse(localStorage.getItem(STORAGE_KEYS.PATRON) || `[${new Array(42).fill(0).join(',')}]`) || new Array(42).fill(0);
        start = localStorage.getItem(STORAGE_KEYS.START) || '2026-01-01';
        config = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG) || '{}') || {};
      } catch (e) {
        console.error('Error loading LocalStorage', e);
      }
      const currentYear = new Date().getFullYear().toString();
      if (config.salario !== undefined) { config = { [currentYear]: config }; }
      else if (Object.keys(config).length === 0) { config = { [currentYear]: { ...DEFAULT_CONFIG } }; }
      
      setState({ data, extras, config, patron, start });
      setIsLoaded(true);
    };
    if (!user) loadLocal();
  }, [user]);

  // 2. Firebase Sync Logic
  useEffect(() => {
    if (!user) return;

    // A. Sync User Profile (Settings)
    const userRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudSettings = docSnap.data();
        setState(prev => ({
          ...prev,
          patron: cloudSettings.patron || prev.patron,
          start: cloudSettings.start || prev.start,
          config: cloudSettings.config || prev.config
        }));
      } else {
        // First time user? Push local settings to cloud
        setDoc(userRef, {
          patron: state.patron,
          start: state.start,
          config: state.config
        });
      }
    });

    // B. Sync Turns Collection
    const turnsRef = collection(db, 'users', user.uid, 'turns');
    const unsubTurns = onSnapshot(turnsRef, (querySnap) => {
      const newData: Record<string, number> = {};
      const newExtras: Record<string, number> = {};
      
      querySnap.forEach(docSnap => {
        const turn = docSnap.data();
        if (turn.type) newData[docSnap.id] = turn.type;
        if (turn.extraHours) newExtras[docSnap.id] = turn.extraHours;
      });

      setState(prev => ({
        ...prev,
        data: newData,
        extras: newExtras
      }));
    });

    return () => {
      unsubProfile();
      unsubTurns();
    };
  }, [user]);

  const saveState = async (newState: Partial<AppState>) => {
    // 1. Update Local State
    setState(prev => {
      const updated = { ...prev, ...newState };
      
      // 2. Persist to LocalStorage (always as fallback)
      try {
        if (newState.data) localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(updated.data));
        if (newState.extras) localStorage.setItem(STORAGE_KEYS.EXTRAS, JSON.stringify(updated.extras));
        if (newState.config) localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated.config));
        if (newState.patron) localStorage.setItem(STORAGE_KEYS.PATRON, JSON.stringify(updated.patron));
        if (newState.start) localStorage.setItem(STORAGE_KEYS.START, updated.start);
      } catch (e) {
        console.warn('Storage disabled');
      }

      // 3. Persist to Firestore if user logged in
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        // Settings update
        if (newState.patron || newState.start || newState.config) {
          const up: any = {};
          if (newState.patron) up.patron = newState.patron;
          if (newState.start) up.start = newState.start;
          if (newState.config) up.config = newState.config;
          updateDoc(userRef, up).catch(e => {
            if (e.code === 'not-found') setDoc(userRef, up);
          });
        }
      }

      return updated;
    });
  };

  const updateData = async (date: string, type: number) => {
    if (user) {
      const turnRef = doc(db, 'users', user.uid, 'turns', date);
      if (type === 0) {
        // Check if we need to fully delete or just clear type
        const turnSnap = await getDoc(turnRef);
        if (turnSnap.exists() && turnSnap.data().extraHours) {
          updateDoc(turnRef, { type: 0 });
        } else {
          const batch = writeBatch(db);
          batch.delete(turnRef);
          await batch.commit();
        }
      } else {
        setDoc(turnRef, { type }, { merge: true });
      }
    } else {
      const newData = { ...state.data };
      if (type === 0) delete newData[date];
      else newData[date] = type;
      saveState({ data: newData });
    }
  };

  const updateExtra = async (date: string, hours: number) => {
    if (user) {
      const turnRef = doc(db, 'users', user.uid, 'turns', date);
      if (hours === 0 || isNaN(hours)) {
        const turnSnap = await getDoc(turnRef);
        if (turnSnap.exists() && turnSnap.data().type) {
          updateDoc(turnRef, { extraHours: 0 });
        } else {
          const batch = writeBatch(db);
          batch.delete(turnRef);
          await batch.commit();
        }
      } else {
        setDoc(turnRef, { extraHours: hours }, { merge: true });
      }
    } else {
      const newExtras = { ...state.extras };
      if (hours === 0 || isNaN(hours)) delete newExtras[date];
      else newExtras[date] = hours;
      saveState({ extras: newExtras });
    }
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

  const applyPatron = async (year: number, refMonday: Date) => {
    const newData = { ...state.data };
    Object.keys(newData).forEach(key => {
      if (key.startsWith(year.toString())) delete newData[key];
    });

    const d = new Date(year, 0, 1, 12, 0, 0);
    const end = new Date(year, 11, 31, 12, 0, 0);

    const updates: Record<string, number> = {};

    while (d <= end) {
      const diff = Math.round((d.getTime() - refMonday.getTime()) / 86400000);
      let pIdx = diff % 42;
      if (pIdx < 0) pIdx += 42;

      if (state.patron[pIdx] !== 1) {
        const w = d.getDay();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const type = (w === 0 || w === 6) ? 2 : 1;
        newData[dateStr] = type;
        updates[dateStr] = type;
      }
      d.setDate(d.getDate() + 1);
    }

    if (user) {
      // For large updates, we'd use batches, but let's just update local then push
      // Optimization: push in chunks or just handle via saveState logic if it were simpler
      // To ensure cloud sync, we'll push the whole 'newData' or just the new ones
      const batch = writeBatch(db);
      Object.entries(updates).forEach(([date, type]) => {
        const ref = doc(db, 'users', user.uid, 'turns', date);
        batch.set(ref, { type }, { merge: true });
      });
      await batch.commit();
    }
    saveState({ data: newData });
  };

  const resetYear = async (year: number) => {
    const newData = { ...state.data };
    const toDelete: string[] = [];
    Object.keys(newData).forEach(key => {
      if (key.startsWith(year.toString())) {
        delete newData[key];
        toDelete.push(key);
      }
    });

    if (user) {
      const batch = writeBatch(db);
      for (const date of toDelete) {
        const ref = doc(db, 'users', user.uid, 'turns', date);
        batch.delete(ref);
      }
      await batch.commit();
    }
    saveState({ data: newData });
  };

  if (!isLoaded) return (
    <div className="flex items-center justify-center h-screen bg-[#050505] text-[#00e676] font-black text-2xl animate-pulse">
      CONECTANDO...
    </div>
  );

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
