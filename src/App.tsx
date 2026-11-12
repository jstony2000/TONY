// Sync Nudge
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Calendar } from './components/Calendar';
import { MiniStats } from './components/MiniStats';
import { SummaryPanel } from './components/SummaryPanel';
import { ConfigModal } from './components/ConfigModal';
import { ExtraHoursModal } from './components/ExtraHoursModal';
import { Lock, Unlock, Settings, Save, ChevronLeft, ChevronRight, Clock, User as UserIcon, Cloud, Maximize2, Minimize2 } from 'lucide-react';
import { APP_VERSION, SHIFT_TYPES } from './lib/constants';

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
  const { state, updateData } = useAppContext();
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

  const handlePrevMonth = () => {
    setDirection(-1);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const swipeThreshold = 50;
    if (distance > swipeThreshold) {
      handleNextMonth();
    } else if (distance < -swipeThreshold) {
      handlePrevMonth();
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

  const handleBackup = () => {
    const backup = {
      data: state.data,
      configAnual: state.config,
      extras: state.extras,
      patron: state.patron,
      start: state.start
    };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nomina_stellantis_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
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
        {/* Header - Oculto en modo horizontal móvil */}
        {!isLandscapeMobile && (
          <div className="flex justify-between items-center px-2 sm:px-3 py-1.5 bg-[#111] border-b border-gray-800 shrink-0 min-h-[54px]">
            <button onClick={handlePrevMonth} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded text-lg font-black hover:bg-gray-700">
              <ChevronLeft size={18} />
            </button>
            
            <div onClick={handleToday} className="flex-1 flex flex-col items-center justify-center m-0 px-1 cursor-pointer hover:opacity-90">
              <h2 className="text-white uppercase font-black text-sm sm:text-xl leading-tight whitespace-nowrap">
                {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(' de ', ' ')}
              </h2>
              <span className="text-[9px] font-mono font-bold text-[#2979ff] bg-[#2979ff]/15 border border-[#2979ff]/40 px-1.5 py-0 rounded mt-0.5">
                {APP_VERSION}
              </span>
            </div>

            <div className="flex gap-1 sm:gap-1.5">
              <button 
                onClick={user ? logout : login} 
                className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-gray-700 rounded hover:bg-gray-700 ${user ? 'text-[#00e676]' : 'text-gray-400'}`}
                title={user ? `Sincronizado como ${user.email}` : "Iniciar sesión para sincronizar"}
              >
                {user ? <Cloud size={15} /> : <UserIcon size={15} />}
              </button>
              <button onClick={handleNextMonth} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded text-lg font-black hover:bg-gray-700">
                <ChevronRight size={18} />
              </button>
              <button 
                onClick={toggleLock} 
                title={editMode === 0 ? "Bloqueado" : editMode === 1 ? "Modo Edición Turnos" : "Modo Horas Extra"}
                className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-gray-700 rounded transition-colors ${
                  editMode === 0 ? 'bg-red-600 hover:bg-red-700' : 
                  editMode === 1 ? 'bg-green-500 hover:bg-green-600' : 
                  'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {editMode === 0 ? <Lock size={15} /> : editMode === 1 ? <Unlock size={15} /> : <Clock size={15} />}
              </button>
              <button
                onClick={toggleFullscreen}
                title="Pantalla completa (ocultar barra URL)"
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded hover:bg-gray-700 text-[#2979ff]"
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button onClick={handleBackup} title="Descargar copia de seguridad JSON" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded hover:bg-gray-700">
                <Save size={15} />
              </button>
              <button onClick={() => handleOpenConfigTab('nomina')} title="Configuración y Simulación de Nómina" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded hover:bg-gray-700">
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
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
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

            <SummaryPanel currentDate={currentDate} />
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
