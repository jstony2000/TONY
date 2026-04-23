// Sync Nudge
import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Calendar } from './components/Calendar';
import { MiniStats } from './components/MiniStats';
import { SummaryPanel } from './components/SummaryPanel';
import { ConfigModal } from './components/ConfigModal';
import { ExtraHoursModal } from './components/ExtraHoursModal';
import { useAppContext } from './context/AppContext';
import { Lock, Unlock, Settings, Save, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

const AppContent = () => {
  const { state, updateData } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editMode, setEditMode] = useState(0); // 0: Locked, 1: Shifts, 2: Extras
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [selectedDisplayDate, setSelectedDisplayDate] = useState('');

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
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
        <div className="flex justify-between items-center px-4 py-2 bg-[#111] border-b border-gray-800 shrink-0 h-[60px]">
          <button onClick={handlePrevMonth} className="w-10 h-10 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded text-xl font-black hover:bg-gray-700">
            <ChevronLeft />
          </button>
          <h2 onClick={handleToday} className="m-0 text-white uppercase font-black text-xl sm:text-2xl cursor-pointer hover:text-gray-300">
            {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(' de ', ' ')}
          </h2>
          <div className="flex gap-2">
            <button onClick={handleNextMonth} className="w-10 h-10 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded text-xl font-black hover:bg-gray-700">
              <ChevronRight />
            </button>
            <button 
              onClick={toggleLock} 
              className={`w-10 h-10 flex items-center justify-center border border-gray-700 rounded transition-colors ${
                editMode === 0 ? 'bg-red-600 hover:bg-red-700' : 
                editMode === 1 ? 'bg-green-500 hover:bg-green-600' : 
                'bg-orange-500 hover:bg-orange-600'
              }`}
              title={editMode === 0 ? "Bloqueado" : editMode === 1 ? "Modo Turnos" : "Modo Extras"}
            >
              {editMode === 0 ? <Lock size={20} /> : editMode === 1 ? <Unlock size={20} /> : <Clock size={20} />}
            </button>
            <button onClick={handleBackup} className="w-10 h-10 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded hover:bg-gray-700">
              <Save size={20} />
            </button>
            <button onClick={() => setIsConfigOpen(true)} className="w-10 h-10 flex items-center justify-center bg-[#2a2a2a] border border-gray-700 rounded hover:bg-gray-700">
              <Settings size={20} />
            </button>
          </div>
        </div>

        <MiniStats currentDate={currentDate} />
        
        <Calendar currentDate={currentDate} editMode={editMode} onDayClick={handleDayClick} />

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
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
