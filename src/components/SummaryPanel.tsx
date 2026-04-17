import React from 'react';
import { useAppContext } from '../context/AppContext';
import { SHIFT_TYPES } from '../lib/constants';

export const SummaryPanel = ({ currentDate }: { currentDate: Date }) => {
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

  return (
    <div className="bg-[#111] border-t border-gray-800 p-3 flex-shrink-0 grid grid-cols-4 gap-2 text-center">
      <div className="flex flex-col">
        <span className="text-[0.55rem] text-gray-400 uppercase font-black mb-0.5">TRABAJADOS</span>
        <span className="text-lg sm:text-2xl font-black text-white">{cT}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[0.55rem] text-[#2979ff] uppercase font-black mb-0.5">NOCHES</span>
        <span className="text-lg sm:text-2xl font-black text-white">{cN}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[0.55rem] text-[#ff1744] uppercase font-black mb-0.5">FESTIVOS</span>
        <span className="text-lg sm:text-2xl font-black text-white">{cF}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[0.55rem] text-gray-400 uppercase font-black mb-0.5">LIBRES</span>
        <span className="text-lg sm:text-2xl font-black text-white">{daysInMonth - cT}</span>
      </div>
    </div>
  );
};
