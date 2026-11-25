// Sync Nudge
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Calendar } from './components/Calendar';
import { MiniStats } from './components/MiniStats';
import { SummaryPanel } from './components/SummaryPanel';
import { ConfigModal } from './components/ConfigModal';
import { ExtraHoursModal } from './components/ExtraHoursModal';
import { Lock, Unlock, Settings, ChevronLeft, ChevronRight, Clock, User as UserIcon, Cloud, CloudOff, Maximize2, Minimize2 } from 'lucide-react';
import { SHIFT_TYPES } from './lib/constants';

const LEGEND_ITEMS = [
  { type: SHIFT_TYPES.DIA, label: 'DÍA', dotClass: 'bg-white border border-gray-400' },
  { type: SHIFT_TYPES.NOCHE, label: 'NOCHE', dotClass: 'bg-[#2979ff]' },
  { type: SHIFT_TYPES.FESTIVO, label: 'FEST', dotClass: 'bg-[#ff1744]' },
  { type: SHIFT_TYPES.VACACIONES, label: 'VAC', dotClass: 'bg-[#00e676]' },
  { type: SHIFT_TYPES.CONVENIO, label: 'CONV', dotClass: 'bg-[#ffea00]' },
  { type: SHIFT_TYPES.ADECUACION, label: 'ADEC', dotClass: 'bg-[#00b0ff]' },
  { type: SHIFT_TYPES.LIBRE, label: 'LIBRE', dotClass: 'bg-[#888]' },
];

const AppContent = () => {
  const { state, syncStatus, updateData } = useAppContext();
  const { user, login, logout } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [direction, setDirection] = useState(0);
  const [editMode, setEditMode] = useState(0); // 0: Locked, 1: Shifts, 2: Extras
  const [activeBrush, setActiveBrush] = useState<number | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [initialConfigTab, setInitialConfigTab] = useState('nomina');
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [selectedDisplayDate, setSelectedDisplayDate] = useState('');
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handlePrevMonth = useCallback(() => {
    setDirection(-1);
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setDirection(1);
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  // Atajos de teclado en PC (flechas izquierda/derecha para cambiar mes)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isConfigOpen || isExtraModalOpen) return;
      if (e.key === 'ArrowLeft') handlePrevMonth();
      else if (e.key === 'ArrowRight') handleNextMonth();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isConfigOpen, isExtraModalOpen, handlePrevMonth, handleNextMonth]);

  // Detectar giro horizontal en móvil y estado de pantalla completa
  useEffect(() => {
    const checkViewport = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const landscape = w > h && h <= 580;
      setIsLandscapeMobile(landscape);
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);
    document.addEventListener('fullscreenchange', checkViewport);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
      document.removeEventListener('fullscreenchange', checkViewport);
    };
  }, []);

  // Activar pantalla completa automáticamente al primer toque en móvil si se abre desde navegador con barra URL
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    const tryAutoFullscreen = () => {
      const isMobileDevice = 'ontouchstart' in window && Math.min(window.innerWidth, window.innerHeight) <= 600;
      if (isMobileDevice && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    window.addEventListener('touchend', tryAutoFullscreen, { once: true, passive: true });
    return () => window.removeEventListener('touchend', tryAutoFullscreen);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    const t = e.targetTouches[0];
    setTouchStart({ x: t.clientX, y: t.clientY });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.targetTouches[0];
    setTouchEnd({ x: t.clientX, y: t.clientY });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const dx = touchStart.x - touchEnd.x;
    const dy = touchStart.y - touchEnd.y;
    const swipeThreshold = 55;
    if (Math.abs(dx) > Math.abs(dy) * 1.3 && Math.abs(dx) > swipeThreshold) {
      if (dx > 0) handleNextMonth();
      else handlePrevMonth();
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const toggleLock = () => {
    setEditMode((prev) => {
      const next = (prev + 1) % 3;
      if (next !== 1) setActiveBrush(null);
      return next;
    });
  };

  const handleDayClick = (dateStr: string, day: number, month: number, year: number) => {
    if (editMode === 0) return;
    if (editMode === 1) {
      const currentType = state.data[dateStr] || 0;
      if (activeBrush !== null) {
        const nextType = currentType === activeBrush ? 0 : activeBrush;
        updateData(dateStr, nextType);
      } else {
        updateData(dateStr, (currentType + 1) % 7);
      }
    } else if (editMode === 2) {
      setSelectedDateStr(dateStr);
      setSelectedDisplayDate(`${day} / ${month + 1} / ${year}`);
      setIsExtraModalOpen(true);
    }
  };

  const handleOpenConfigTab = (tab: string) => {
    setInitialConfigTab(tab);
    setIsConfigOpen(true);
  };

  const getCloudTitle = () => {
    if (!user) return 'Iniciar sesión para sincronizar en la nube';
    if (syncStatus === 'offline') return `Sin conexión (guardado local) - ${user.email}`;
    if (syncStatus === 'syncing') return `Sincronizando... - ${user.email}`;
    return `Sincronizado como ${user.email} (pulsa para cerrar sesión)`;
  };

  return (
    <div
      className="flex justify-center bg-[#050505] text-white overflow-hidden select-none font-sans w-screen h-dvh max-h-dvh"
    >
      <div
        className={`flex flex-col bg-[#050505] h-full max-h-full overflow-hidden ${
          isLandscapeMobile
            ? 'w-screen max-w-none border-0'
            : 'w-full max-w-[600px] border-x border-gray-800'
        }`}
      >
        {/* Header ergonómico: Selector [< MES AÑO >] agrupado a la izquierda + 4 iconos de control a la derecha */}
        {!isLandscapeMobile && (
          <div className="flex justify-between items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-[#111] border-b border-gray-800 shrink-0 min-h-[52px]">
            <div className="flex items-center gap-1 flex-1 min-w-0 bg-[#1a1a1a] border border-gray-800 rounded-md p-0.5">
              <button
                onClick={handlePrevMonth}
                title="Mes anterior"
                className="w-7 h-8 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center bg-[#2a2a2a] hover:bg-gray-700 rounded text-white active:scale-95 transition-transform cursor-pointer"
              >
                <ChevronLeft size={17} />
              </button>

              <h2
                onClick={handleToday}
                title="Toca para ir al mes actual"
                className="flex-1 min-w-0 text-center m-0 px-1 text-white uppercase font-black text-[13px] sm:text-lg tracking-tight truncate cursor-pointer hover:text-[#2979ff] transition-colors"
              >
                {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(' de ', ' ')}
              </h2>

              <button
                onClick={handleNextMonth}
                title="Mes siguiente"
                className="w-7 h-8 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center bg-[#2a2a2a] hover:bg-gray-700 rounded text-white active:scale-95 transition-transform cursor-pointer"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button 
                onClick={toggleLock} 
                title={editMode === 0 ? 'Bloqueado' : editMode === 1 ? 'Modo Edición Turnos' : 'Modo Horas Extra'}
                className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-gray-700 rounded transition-colors cursor-pointer ${
                  editMode === 0 ? 'bg-red-600 hover:bg-red-700' : 
                  editMode === 1 ? 'bg-green-500 hover:bg-green-600' : 
                  'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {editMode === 0 ? <Lock size={15} /> : editMode === 1 ? <Unlock size={15} /> : <Clock size={15} />}
              </button>

              <button 
                onClick={user ? logout : login} 
                className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded hover:bg-gray-700 cursor-pointer ${
                  !user ? 'text-gray-400' :
                  syncStatus === 'offline' ? 'text-amber-400' :
                  syncStatus === 'syncing' ? 'text-[#2979ff] animate-pulse' :
                  'text-[#00e676]'
                }`}
                title={getCloudTitle()}
              >
                {!user ? <UserIcon size={15} /> : syncStatus === 'offline' ? <CloudOff size={15} /> : <Cloud size={15} />}
              </button>

              <button
                onClick={toggleFullscreen}
                title="Pantalla completa"
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded hover:bg-gray-700 text-[#2979ff] cursor-pointer"
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>

              <button
                onClick={() => handleOpenConfigTab('nomina')}
                title="Configuración y Simulación de Nómina"
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded hover:bg-gray-700 text-white cursor-pointer"
              >
                <Settings size={15} />
              </button>
            </div>
          </div>
        )}

        {/* MiniStats - Oculto en modo horizontal móvil */}
        {!isLandscapeMobile && (
          <MiniStats currentDate={currentDate} onOpenConfigTab={handleOpenConfigTab} />
        )}
        
        {/* Calendario - Ocupa el 100% en horizontal y el espacio flexible en vertical */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentDate.toISOString()}
              custom={direction}
              initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -300 : 300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              className="w-full h-full absolute inset-0 touch-pan-y"
            >
              <Calendar
                currentDate={currentDate}
                editMode={editMode}
                onDayClick={handleDayClick}
                isLandscapeMobile={isLandscapeMobile}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Leyenda y Contadores Inferiores - Ocultos en modo horizontal móvil */}
        {!isLandscapeMobile && (
          <>
            <div className="flex justify-center flex-wrap gap-1.5 sm:gap-2 p-1.5 bg-[#080808] border-t border-gray-800 shrink-0 text-[0.6rem] text-gray-400 uppercase font-bold">
              {LEGEND_ITEMS.map(item => {
                const isSelected = editMode === 1 && activeBrush === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      if (editMode !== 1) setEditMode(1);
                      setActiveBrush(prev => prev === item.type ? null : item.type);
                    }}
                    title="Toca para activar/desactivar pincel directo de este turno"
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2979ff]/25 text-white ring-1 ring-[#2979ff] scale-105'
                        : 'hover:text-white'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${item.dotClass}`}></span>
                    {item.label}
                  </button>
                );
              })}
            </div>

            <SummaryPanel currentDate={currentDate} onOpenPayroll={() => handleOpenConfigTab('nomina')} />
          </>
        )}

        <ConfigModal
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          currentDate={currentDate}
          initialTab={initialConfigTab}
        />
        <ExtraHoursModal isOpen={isExtraModalOpen} onClose={() => setIsExtraModalOpen(false)} dateStr={selectedDateStr} displayDate={selectedDisplayDate} />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
