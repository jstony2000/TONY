import React from 'react';
import { useAppContext } from '../context/AppContext';
import { SHIFT_TYPES } from '../lib/constants';

interface SummaryPanelProps {
  currentDate: Date;
  onOpenPayroll?: () => void;
}

export const SummaryPanel = ({ currentDate }: SummaryPanelProps) => {
  const { state } = useAppContext();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  let cT = 0, cN = 0, cF = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const est = state.data[k] || 0;
    if (est === SHIFT_TYPES.NOCHE) {
      cN++;
      cT++;
    } else if (est === SHIFT_TYPES.FESTIVO) {
      cN++;
      cF++;
      cT++;
    } else if (est === SHIFT_TYPES.DIA) {
      cT++;
    }
  }

  const libres = daysInMonth - cT;

  return (
    <div
      className="bg-[#111] border-t border-gray-800 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] shrink-0 grid grid-cols-4 gap-2 text-center"
    >
      <div className="flex flex-col items-center justify-center">
        <span className="text-[0.55rem] text-gray-400 uppercase font-black leading-tight">TRABAJADOS</span>
        <span className="text-xl sm:text-2xl font-black text-white leading-tight mt-0.5">{cT}</span>
      </div>
      <div className="flex flex-col items-center justify-center">
        <span className="text-[0.55rem] text-[#2979ff] uppercase font-black leading-tight">NOCHES</span>
        <span className="text-xl sm:text-2xl font-black text-white leading-tight mt-0.5">{cN}</span>
      </div>
      <div className="flex flex-col items-center justify-center">
        <span className="text-[0.55rem] text-[#ff1744] uppercase font-black leading-tight">FESTIVOS</span>
        <span className="text-xl sm:text-2xl font-black text-white leading-tight mt-0.5">{cF}</span>
      </div>
      <div className="flex flex-col items-center justify-center">
        <span className="text-[0.55rem] text-gray-400 uppercase font-black leading-tight">LIBRES</span>
        <span className="text-xl sm:text-2xl font-black text-white leading-tight mt-0.5">{libres}</span>
      </div>
    </div>
  );
};
