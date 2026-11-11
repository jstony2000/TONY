import React from 'react';
import { useAppContext } from '../context/AppContext';
import { getYearConfig, calculatePayrollForMonth } from '../lib/constants';

interface SummaryPanelProps {
  currentDate: Date;
  onOpenPayroll?: () => void;
}

export const SummaryPanel = ({ currentDate, onOpenPayroll }: SummaryPanelProps) => {
  const { state } = useAppContext();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const conf = getYearConfig(state.config, year);
  const payroll = calculatePayrollForMonth(year, month, state.data, state.extras, conf);

  const fmtM = (n: number) => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-[#111] border-t border-gray-800 flex-shrink-0 flex flex-col">
      <div className="p-2.5 grid grid-cols-4 gap-2 text-center">
        <div className="flex flex-col">
          <span className="text-[0.55rem] text-gray-400 uppercase font-black mb-0.5">TRABAJADOS</span>
          <span className="text-lg sm:text-2xl font-black text-white leading-none">{payroll.cT}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[0.55rem] text-[#2979ff] uppercase font-black mb-0.5">NOCHES</span>
          <span className="text-lg sm:text-2xl font-black text-white leading-none">{payroll.cN}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[0.55rem] text-[#ff1744] uppercase font-black mb-0.5">FESTIVOS</span>
          <span className="text-lg sm:text-2xl font-black text-white leading-none">{payroll.cF}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[0.55rem] text-gray-400 uppercase font-black mb-0.5">LIBRES</span>
          <span className="text-lg sm:text-2xl font-black text-white leading-none">{payroll.daysInMonth - payroll.cT}</span>
        </div>
      </div>

      <div
        onClick={onOpenPayroll}
        title="Toca para abrir el recibo detallado de este mes"
        className="bg-[#0a0f1d] hover:bg-[#111a30] border-t border-[#2979ff]/30 px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2 text-[0.68rem] sm:text-xs text-gray-300 font-mono">
          <span className="text-gray-400 font-sans font-bold uppercase">BRUTO:</span>
          <span className="font-bold text-white">{fmtM(payroll.totalBruto)} €</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono">
          <span className="text-[#2979ff] font-sans font-black uppercase text-[0.68rem] sm:text-xs">LÍQUIDO MES:</span>
          <span className="font-black text-[#00e676]">{fmtM(payroll.liquido)} €</span>
          <span className="text-[10px] text-[#2979ff] ml-0.5">↗</span>
        </div>
      </div>
    </div>
  );
};
