// Sync Nudge
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Calendar } from './components/Calendar';
import { MiniStats } from './components/MiniStats';
import { SummaryPanel } from './components/SummaryPanel';
import { ConfigModal } from './components/ConfigModal';
import { ExtraHoursModal } from './components/ExtraHoursModal';
import { useAppContext } from './context/AppContext';
import { Lock, Unlock, Settings, Save, ChevronLeft, ChevronRight, Clock, User as UserIcon, LogOut, Cloud } from 'lucide-react';

const AppContent = () => {
  const { state, updateData } = useAppContext();
  const { user, login, logout } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right
  const [editMode, setEditMode] = useState(0); // 0: Locked, 1: Shifts, 2: Extras
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [selectedDisplayDate, setSelectedDisplayDate] = useState('');

  const handlePrevMonth = () => {
    setDirection(-1);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDragEnd = (_: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold) {
      handlePrevMonth();
    } else if (info.offset.x < -swipeThreshold) {
      handleNextMonth();
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const toggleLock = () => {
    setEditMode((prev) => (prev + 1) % 3);
  };

  const handleDayClick = (dateStr: string, day: number, month: number, year: number) => {
    if (editMode === 0) {
      // Locked, maybe show a brief animation on the lock button
      return;
    }
    if (editMode === 1) {
      // Toggle shift
      const currentType = state.data[dateStr] || 0;
      updateData(dateStr, (currentType + 1) % 7);
    } else if (editMode === 2) {
      // Open extra hours modal
      setSelectedDateStr(dateStr);
      setSelectedDisplayDate(`${day} / ${month + 1} / ${year}`);
      setIsExtraModalOpen(true);
    }
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
    <div className="flex justify-center bg-[#050505] text-white overflow-hidden select-none font-sans" style={{ minHeight: '100vh', width: '100vw', position: 'relative' }}>
      <div className="w-full max-w-[600px] flex flex-col bg-[#050505] border-x border-gray-800" style={{ minHeight: '100vh', width: '100%', maxWidth: '600px', position: 'relative' }}>
        
        {/* Header */}
        <div className="flex justify-between items-center px-2 sm:px-4 py-2 bg-[#111] border-b border-gray-800 shrink-0 min-h-[60px]">
          <button onClick={handlePrevMonth} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded text-lg sm:text-xl font-black hover:bg-gray-700">
            <ChevronLeft size={18} />
          </button>
          
          <h2 onClick={handleToday} className="flex-1 text-center m-0 px-1 text-white uppercase font-black text-sm sm:text-2xl cursor-pointer hover:text-gray-300 whitespace-nowrap overflow-visible">
            {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(' de ', ' ')}
          </h2>

          <div className="flex gap-1 sm:gap-2">
            <button 
              onClick={user ? logout : login} 
              className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-gray-700 rounded hover:bg-gray-700 ${user ? 'text-[#00e676]' : 'text-gray-400'}`}
              title={user ? `Sincronizado como ${user.email}` : "Iniciar sesión para sincronizar"}
            >
              {user ? <Cloud size={16} /> : <UserIcon size={16} />}
            </button>
            <button onClick={handleNextMonth} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded text-lg sm:text-xl font-black hover:bg-gray-700">
              <ChevronRight size={18} />
            </button>
            <button 
              onClick={toggleLock} 
              className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-gray-700 rounded transition-colors ${
                editMode === 0 ? 'bg-red-600 hover:bg-red-700' : 
                editMode === 1 ? 'bg-green-500 hover:bg-green-600' : 
                'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              {editMode === 0 ? <Lock size={16} /> : editMode === 1 ? <Unlock size={16} /> : <Clock size={16} />}
            </button>
            <button onClick={handleBackup} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded hover:bg-gray-700">
              <Save size={16} />
            </button>
            <button onClick={() => setIsConfigOpen(true)} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded hover:bg-gray-700">
              <Settings size={16} />
            </button>
          </div>
        </div>

        <MiniStats currentDate={currentDate} />
        
        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentDate.toISOString()}
              custom={direction}
              initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -300 : 300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="w-full absolute inset-0"
            >
              <Calendar currentDate={currentDate} editMode={editMode} onDayClick={handleDayClick} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div className="flex justify-center flex-wrap gap-2.5 p-2 bg-[#080808] border-t border-gray-800 shrink-0 text-[0.65rem] text-gray-400 uppercase font-bold">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-400 inline-block"></span> DÍA</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#2979ff] inline-block"></span> NOCHE</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ff1744] inline-block"></span> FEST</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#00e676] inline-block"></span> VAC</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ffea00] inline-block"></span> CONV</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#00b0ff] inline-block"></span> ADEC</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#888] inline-block"></span> LIBRE</span>
        </div>

        <SummaryPanel currentDate={currentDate} />

        <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} currentDate={currentDate} />
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
