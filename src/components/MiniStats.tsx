import React from 'react';
import { useAppContext } from '../context/AppContext';
import { SHIFT_TYPES, getYearConfig } from '../lib/constants';

interface MiniStatsProps {
  currentDate: Date;
  onOpenConfigTab?: (tab: string) => void;
}

export const MiniStats = ({ currentDate, onOpenConfigTab }: MiniStatsProps) => {
  const { state } = useAppContext();
  const year = currentDate.getFullYear();
  
  let diasT = 0, cVacAnual = 0, cConvAnual = 0, cAdecAnual = 0;
  
  Object.entries(state.data).forEach(([k, est]) => {
    if (k.startsWith(year.toString())) {
      if (est === SHIFT_TYPES.NOCHE || est === SHIFT_TYPES.FESTIVO || est === SHIFT_TYPES.DIA) diasT++;
      if (est === SHIFT_TYPES.VACACIONES) cVacAnual++;
      if (est === SHIFT_TYPES.CONVENIO) cConvAnual++;
      if (est === SHIFT_TYPES.ADECUACION) cAdecAnual++;
    }
  });

  const conf = getYearConfig(state.config, year);
  let hExtraAnual = Number(conf.extraBase) || 0;
  
  Object.entries(state.extras).forEach(([k, val]) => {
    if (k.startsWith(year.toString())) hExtraAnual += Number(val) || 0;
  });

  const horasTrabajadas = (diasT * 7.75).toFixed(1);
  const adecTotal = Number(conf.adecTotal) || 8;
  const bolsa = (Number(conf.bolsa) || 0).toFixed(1);

  return (
    <div className="grid grid-cols-6 gap-0.5 p-0.5 bg-black border-b border-gray-800 text-center flex-shrink-0 relative">
      <div className="flex flex-col items-center justify-center font-bold border-r border-gray-800 py-1">
        <span className="text-[0.4rem] sm:text-[0.45rem] uppercase text-gray-400 flex flex-col items-center leading-tight">
          H. TRAB<span className="text-[0.3rem] sm:text-[0.35rem] text-gray-500">(1720/AÑO)</span>
        </span>
        <span className="text-[0.65rem] sm:text-xs text-white mt-0.5">{horasTrabajadas}h</span>
      </div>
      
      <div
        onClick={() => onOpenConfigTab?.('datos')}
        title="Ajustar base de horas extra"
        className="flex flex-col items-center justify-center font-bold border-r border-gray-800 bg-[#ff9100]/15 hover:bg-[#ff9100]/25 cursor-pointer transition-colors py-1"
      >
        <span className="text-[0.4rem] sm:text-[0.45rem] uppercase text-[#ff9100] flex flex-col items-center leading-tight">
          EXTRAS ✎<span className="text-[0.3rem] sm:text-[0.35rem] text-gray-500">&nbsp;</span>
        </span>
        <span className="text-[0.65rem] sm:text-xs text-white mt-0.5">{hExtraAnual.toFixed(1)}h</span>
      </div>

      <div
        onClick={() => onOpenConfigTab?.('turnos')}
        className="flex flex-col items-center justify-center font-bold border-r border-gray-800 bg-[#ffea00]/15 hover:bg-[#ffea00]/25 cursor-pointer transition-colors py-1"
      >
        <span className="text-[0.4rem] sm:text-[0.45rem] uppercase text-[#ffea00] flex flex-col items-center leading-tight">
          CONV ✎<span className="text-[0.3rem] sm:text-[0.35rem] text-gray-500">(2/AÑO)</span>
        </span>
        <span className="text-[0.65rem] sm:text-xs text-white mt-0.5">{cConvAnual}</span>
      </div>

      <div
        onClick={() => onOpenConfigTab?.('datos')}
        title="Ajustar total días ADEC"
        className="flex flex-col items-center justify-center font-bold border-r border-gray-800 bg-[#00b0ff]/15 hover:bg-[#00b0ff]/25 cursor-pointer transition-colors py-1"
      >
        <span className="text-[0.4rem] sm:text-[0.45rem] uppercase text-[#00b0ff] flex flex-col items-center leading-tight">
          ADEC ✎<span className="text-[0.3rem] sm:text-[0.35rem] text-gray-500">({cAdecAnual}/{adecTotal})</span>
        </span>
        <span className="text-[0.65rem] sm:text-xs text-white mt-0.5">{cAdecAnual}</span>
      </div>

      <div
        onClick={() => onOpenConfigTab?.('datos')}
        title="Ajustar bolsa oficial del año"
        className="flex flex-col items-center justify-center font-bold border-r border-gray-800 bg-[#ffd700]/15 hover:bg-[#ffd700]/25 cursor-pointer transition-colors py-1"
      >
        <span className="text-[0.4rem] sm:text-[0.45rem] uppercase text-[#ffd700] flex flex-col items-center leading-tight">
          BOLSA ✎<span className="text-[0.3rem] sm:text-[0.35rem] text-gray-500">{year}</span>
        </span>
        <span className="text-[0.65rem] sm:text-xs text-white mt-0.5">{bolsa}h</span>
      </div>

      <div className="flex flex-col items-center justify-center font-bold py-1">
        <span className="text-[0.4rem] sm:text-[0.45rem] uppercase text-[#00e676] flex flex-col items-center leading-tight">
          VAC<span className="text-[0.3rem] sm:text-[0.35rem] text-gray-500">(30/AÑO)</span>
        </span>
        <span className="text-[0.65rem] sm:text-xs text-white mt-0.5">{cVacAnual}</span>
      </div>
    </div>
  );
};
