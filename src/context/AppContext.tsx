import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '../lib/constants';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, writeBatch } from 'firebase/firestore';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline';

type AppState = {
  data: Record<string, number>;
  extras: Record<string, number>;
  config: Record<string, any>;
  patron: number[];
  start: string;
};

type AppContextType = {
  state: AppState;
  syncStatus: SyncStatus;
  updateData: (date: string, type: number) => void;
  updateExtra: (date: string, hours: number) => void;
  updateConfig: (year: string, newConfig: any) => void;
  updatePatron: (index: number, value: number) => void;
  updateStart: (date: string) => void;
  applyPatron: (year: number, refMonday: Date) => void;
  resetYear: (year: number) => void;
  importData: (importedData: any) => boolean;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

// Divide lotes grandes en bloques de 400 para respetar el límite de 500 operaciones de Firestore
async function commitOperationsInChunks(operations: Array<(batch: ReturnType<typeof writeBatch>) => void>) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(op => op(batch));
    await batch.commit();
  }
}

// Elimina undefined y convierte NaN a 0 para evitar rechazos de Firestore
function sanitizeForFirestore(value: any): any {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeForFirestore(item));
  }
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, any> = {};
    Object.entries(value).forEach(([k, v]) => {
      if (v !== undefined) {
        clean[k] = sanitizeForFirestore(v);
      }
    });
    return clean;
  }
  return value;
}

// Garantiza cumplimiento estricto de isValidUser() en firestore.rules
function buildValidUserDoc(s: AppState) {
  const patron42 = Array.isArray(s.patron) && s.patron.length === 42
    ? s.patron.map(v => (v === 1 ? 1 : 0))
    : new Array(42).fill(0);
  const startStr = typeof s.start === 'string' && s.start.length <= 20 && s.start.length > 0
    ? s.start
    : '2026-01-01';
  const cleanConfig = sanitizeForFirestore(s.config || {});
  return {
    patron: patron42,
    start: startStr,
    config: cleanConfig,
  };
}

function loadLocalSnapshot(): AppState {
  let data: Record<string, number> = {};
  let extras: Record<string, number> = {};
  let patron: number[] = new Array(42).fill(0);
  let start = '2026-01-01';
  let config: Record<string, any> = {};

  try {
    data = JSON.parse(localStorage.getItem(STORAGE_KEYS.DATA) || '{}') || {};
    extras = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXTRAS) || '{}') || {};
    const parsedPatron = JSON.parse(localStorage.getItem(STORAGE_KEYS.PATRON) || 'null');
    if (Array.isArray(parsedPatron) && parsedPatron.length === 42) {
      patron = parsedPatron;
    }
    start = localStorage.getItem(STORAGE_KEYS.START) || '2026-01-01';
    config = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG) || '{}') || {};
  } catch (e) {
    console.error('Error loading LocalStorage', e);
  }

  const currentYear = new Date().getFullYear().toString();
  if (config.salario !== undefined) {
    config = { [currentYear]: config };
  } else if (Object.keys(config).length === 0) {
    config = { [currentYear]: { ...DEFAULT_CONFIG } };
  }

  return { data, extras, config, patron, start };
}

function persistLocal(updated: AppState) {
  try {
    localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(updated.data));
    localStorage.setItem(STORAGE_KEYS.EXTRAS, JSON.stringify(updated.extras));
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated.config));
    localStorage.setItem(STORAGE_KEYS.PATRON, JSON.stringify(updated.patron));
    localStorage.setItem(STORAGE_KEYS.START, updated.start);
  } catch {
    // Ignorar en modos privados sin cuota
  }
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>(() => loadLocalSnapshot());
  const stateRef = useRef<AppState>(state);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const hasMigratedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Monitorización de estado online/offline del navegador
  useEffect(() => {
    const handleOffline = () => {
      if (user) setSyncStatus('offline');
    };
    const handleOnline = () => {
      if (user) setSyncStatus('syncing');
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [user]);

  // Sincronización en tiempo real con Firebase Firestore + Espejo en LocalStorage
  useEffect(() => {
    if (!user) {
      hasMigratedRef.current = false;
      setSyncStatus('local');
      return;
    }

    setSyncStatus(navigator.onLine ? 'syncing' : 'offline');

    const userRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const cloudSettings = docSnap.data();
          setState(prev => {
            const next: AppState = {
              ...prev,
              patron: Array.isArray(cloudSettings.patron) && cloudSettings.patron.length === 42 ? cloudSettings.patron : prev.patron,
              start: typeof cloudSettings.start === 'string' ? cloudSettings.start : prev.start,
              config: cloudSettings.config || prev.config,
            };
            persistLocal(next);
            return next;
          });
        } else {
          setDoc(userRef, buildValidUserDoc(stateRef.current)).catch((err) => {
            console.warn('Error creating user profile in cloud:', err);
          });
        }
        setSyncStatus(docSnap.metadata.fromCache && !navigator.onLine ? 'offline' : 'synced');
      },
      (err) => {
        console.warn('Firestore profile listener error:', err);
        setSyncStatus('offline');
      }
    );

    const turnsRef = collection(db, 'users', user.uid, 'turns');
    const unsubTurns = onSnapshot(
      turnsRef,
      async (querySnap) => {
        if (querySnap.empty && !hasMigratedRef.current) {
          hasMigratedRef.current = true;
          const currentLocal = stateRef.current;
          const hasLocalData =
            Object.keys(currentLocal.data).length > 0 ||
            Object.keys(currentLocal.extras).length > 0;

          if (hasLocalData) {
            const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
            const allDates = new Set([
              ...Object.keys(currentLocal.data),
              ...Object.keys(currentLocal.extras),
            ]);
            allDates.forEach(date => {
              const payload: Record<string, number> = {};
              const t = Math.trunc(Number(currentLocal.data[date] || 0));
              const e = Number(currentLocal.extras[date] || 0);
              if (t !== 0) payload.type = t;
              if (Number.isFinite(e) && e !== 0) payload.extraHours = e;
              if (Object.keys(payload).length > 0) {
                ops.push(b => b.set(doc(db, 'users', user.uid, 'turns', date), payload, { merge: true }));
              }
            });
            if (ops.length > 0) {
              await commitOperationsInChunks(ops).catch(console.error);
              return;
            }
          }
        } else {
          hasMigratedRef.current = true;
        }

        const newData: Record<string, number> = {};
        const newExtras: Record<string, number> = {};

        querySnap.forEach(docSnap => {
          const turn = docSnap.data();
          if (turn.type) newData[docSnap.id] = turn.type;
          if (turn.extraHours) newExtras[docSnap.id] = turn.extraHours;
        });

        setState(prev => {
          const next: AppState = { ...prev, data: newData, extras: newExtras };
          persistLocal(next);
          return next;
        });

        setSyncStatus(querySnap.metadata.fromCache && !navigator.onLine ? 'offline' : 'synced');
      },
      (err) => {
        console.warn('Firestore turns listener error:', err);
        setSyncStatus('offline');
      }
    );

    return () => {
      unsubProfile();
      unsubTurns();
    };
  }, [user]);

  const syncUserSettings = async (updated: AppState) => {
    if (!user) return;
    setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
    const userRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userRef, buildValidUserDoc(updated));
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    } catch (e) {
      console.warn('Sync user settings error:', e);
      setSyncStatus('offline');
    }
  };

  // Actualización optimista (0ms latencia en pantalla) + sincronización Firestore
  const updateData = async (date: string, type: number) => {
    const cleanType = Math.trunc(Number(type)) || 0;
    const prevExtrasForDay = stateRef.current.extras[date];

    setState(prev => {
      const nextData = { ...prev.data };
      if (cleanType === 0) delete nextData[date];
      else nextData[date] = cleanType;
      const next = { ...prev, data: nextData };
      persistLocal(next);
      return next;
    });

    if (user) {
      setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
      const turnRef = doc(db, 'users', user.uid, 'turns', date);
      try {
        if (cleanType === 0) {
          if (prevExtrasForDay) {
            await updateDoc(turnRef, { type: 0 });
          } else {
            const turnSnap = await getDoc(turnRef);
            if (turnSnap.exists() && turnSnap.data().extraHours) {
              await updateDoc(turnRef, { type: 0 });
            } else {
              const batch = writeBatch(db);
              batch.delete(turnRef);
              await batch.commit();
            }
          }
        } else {
          await setDoc(turnRef, { type: cleanType }, { merge: true });
        }
        setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      } catch (e) {
        console.warn('Sync turn error:', e);
        setSyncStatus('offline');
      }
    }
  };

  const updateExtra = async (date: string, hours: number) => {
    const cleanHours = !Number.isFinite(hours) || hours === 0 ? 0 : hours;
    const prevTypeForDay = stateRef.current.data[date];

    setState(prev => {
      const nextExtras = { ...prev.extras };
      if (cleanHours === 0) delete nextExtras[date];
      else nextExtras[date] = cleanHours;
      const next = { ...prev, extras: nextExtras };
      persistLocal(next);
      return next;
    });

    if (user) {
      setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
      const turnRef = doc(db, 'users', user.uid, 'turns', date);
      try {
        if (cleanHours === 0) {
          if (prevTypeForDay) {
            await updateDoc(turnRef, { extraHours: 0 });
          } else {
            const turnSnap = await getDoc(turnRef);
            if (turnSnap.exists() && turnSnap.data().type) {
              await updateDoc(turnRef, { extraHours: 0 });
            } else {
              const batch = writeBatch(db);
              batch.delete(turnRef);
              await batch.commit();
            }
          }
        } else {
          await setDoc(turnRef, { extraHours: cleanHours }, { merge: true });
        }
        setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      } catch (e) {
        console.warn('Sync extra error:', e);
        setSyncStatus('offline');
      }
    }
  };

  const updateConfig = (year: string, newConfig: any) => {
    const cleanYearConf = sanitizeForFirestore(newConfig);
    const updated: AppState = {
      ...stateRef.current,
      config: { ...stateRef.current.config, [year]: cleanYearConf },
    };
    setState(updated);
    persistLocal(updated);
    syncUserSettings(updated);
  };

  const updatePatron = (index: number, value: number) => {
    const newPatron = [...stateRef.current.patron];
    newPatron[index] = value === 1 ? 1 : 0;
    const updated: AppState = { ...stateRef.current, patron: newPatron };
    setState(updated);
    persistLocal(updated);
    syncUserSettings(updated);
  };

  const updateStart = (date: string) => {
    const updated: AppState = { ...stateRef.current, start: date };
    setState(updated);
    persistLocal(updated);
    syncUserSettings(updated);
  };

  const applyPatron = async (year: number, refMonday: Date) => {
    const yearPrefix = `${year}-`;
    const prevData = stateRef.current.data;
    const prevExtras = stateRef.current.extras;
    const newData = { ...prevData };
    const oldYearDates: string[] = [];

    Object.keys(newData).forEach(key => {
      if (key.startsWith(yearPrefix)) {
        delete newData[key];
        oldYearDates.push(key);
      }
    });

    const d = new Date(year, 0, 1, 12, 0, 0);
    const end = new Date(year, 11, 31, 12, 0, 0);
    const updates: Record<string, number> = {};

    while (d <= end) {
      const diff = Math.round((d.getTime() - refMonday.getTime()) / 86400000);
      let pIdx = diff % 42;
      if (pIdx < 0) pIdx += 42;

      if (stateRef.current.patron[pIdx] !== 1) {
        const w = d.getDay();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const type = (w === 0 || w === 6) ? 2 : 1;
        newData[dateStr] = type;
        updates[dateStr] = type;
      }
      d.setDate(d.getDate() + 1);
    }

    const updatedState: AppState = { ...stateRef.current, data: newData };
    setState(updatedState);
    persistLocal(updatedState);

    if (user) {
      setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
      const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
      // Limpiar días anteriores que pasaron a LIBRE sin perder horas extra
      oldYearDates.forEach(date => {
        if (!updates[date]) {
          const ref = doc(db, 'users', user.uid, 'turns', date);
          if (prevExtras[date]) {
            ops.push(b => b.set(ref, { type: 0 }, { merge: true }));
          } else {
            ops.push(b => b.delete(ref));
          }
        }
      });
      // Escribir nuevos turnos del patrón
      Object.entries(updates).forEach(([date, type]) => {
        const ref = doc(db, 'users', user.uid, 'turns', date);
        ops.push(b => b.set(ref, { type }, { merge: true }));
      });
      try {
        await commitOperationsInChunks(ops);
        setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      } catch (e) {
        console.error('Error applying patron to Firestore:', e);
        setSyncStatus('offline');
      }
    }
  };

  const resetYear = async (year: number) => {
    const yearPrefix = `${year}-`;
    const newData = { ...stateRef.current.data };
    const prevExtras = stateRef.current.extras;
    const toClear: string[] = [];

    Object.keys(newData).forEach(key => {
      if (key.startsWith(yearPrefix)) {
        delete newData[key];
        toClear.push(key);
      }
    });

    const updatedState: AppState = { ...stateRef.current, data: newData };
    setState(updatedState);
    persistLocal(updatedState);

    if (user && toClear.length > 0) {
      setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
      const ops = toClear.map(date => (b: ReturnType<typeof writeBatch>) => {
        const ref = doc(db, 'users', user.uid, 'turns', date);
        if (prevExtras[date]) {
          b.set(ref, { type: 0 }, { merge: true });
        } else {
          b.delete(ref);
        }
      });
      try {
        await commitOperationsInChunks(ops);
        setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      } catch (e) {
        console.error('Error resetting year in Firestore:', e);
        setSyncStatus('offline');
      }
    }
  };

  const importData = (importedData: any): boolean => {
    if (!importedData || typeof importedData !== 'object') return false;
    const hasValidKey =
      importedData.data ||
      importedData.d ||
      importedData.extras ||
      importedData.e ||
      importedData.configAnual ||
      importedData.config ||
      importedData.patron;
    if (!hasValidKey) return false;

    const prev = stateRef.current;
    const nextData = importedData.data || importedData.d || prev.data;
    const nextExtras = importedData.extras || importedData.e || prev.extras;
    const nextPatron = Array.isArray(importedData.patron) && importedData.patron.length === 42
      ? importedData.patron
      : prev.patron;
    const nextStart = typeof importedData.start === 'string' ? importedData.start : prev.start;

    let nextConfig = prev.config;
    if (importedData.configAnual) {
      nextConfig = sanitizeForFirestore(importedData.configAnual);
    } else if (importedData.config) {
      if (importedData.config.salario !== undefined) {
        nextConfig = { [new Date().getFullYear().toString()]: sanitizeForFirestore(importedData.config) };
      } else {
        nextConfig = sanitizeForFirestore(importedData.config);
      }
    }

    const updated: AppState = {
      data: nextData,
      extras: nextExtras,
      patron: nextPatron,
      start: nextStart,
      config: nextConfig,
    };

    setState(updated);
    persistLocal(updated);

    if (user) {
      syncUserSettings(updated);
      const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
      const allDates = new Set([
        ...Object.keys(updated.data || {}),
        ...Object.keys(updated.extras || {}),
      ]);
      allDates.forEach(date => {
        const payload: Record<string, number> = {};
        const t = Math.trunc(Number(updated.data[date] || 0));
        const e = Number(updated.extras[date] || 0);
        if (t !== 0) payload.type = t;
        if (Number.isFinite(e) && e !== 0) payload.extraHours = e;
        if (Object.keys(payload).length > 0) {
          ops.push(b => b.set(doc(db, 'users', user.uid, 'turns', date), payload, { merge: true }));
        }
      });
      if (ops.length > 0) {
        setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
        commitOperationsInChunks(ops)
          .then(() => setSyncStatus(navigator.onLine ? 'synced' : 'offline'))
          .catch((err) => {
            console.error('Import Firestore error:', err);
            setSyncStatus('offline');
          });
      }
    }

    return true;
  };

  return (
    <AppContext.Provider
      value={{
        state,
        syncStatus,
        updateData,
        updateExtra,
        updateConfig,
        updatePatron,
        updateStart,
        applyPatron,
        resetYear,
        importData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
