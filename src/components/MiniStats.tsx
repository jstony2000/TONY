import React from 'react';
import { useAppContext } from '../context/AppContext';
import { SHIFT_TYPES } from '../lib/constants';

export const MiniStats = ({ currentDate }: { currentDate: Date }) => {
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

  const conf = state.config[year] || state.config[Object.keys(state.config).sort().reverse()[0]] || {};
  let hExtraAnual = Number(conf.extraBase) || 0;
  
  Object.entries(state.extras).forEach(([k, val]) => {
    if (k.startsWith(year.toString())) hExtraAnual += Number(val) || 0;
  });

  const horasTrabajadas = (diasT * 7.75).toFixed(1);
  const adecTotal = Number(conf.adecTotal) || 8;
  const bolsa = (Number(conf.bolsa) || 0).toFixed(1);

  return (
    <div className="grid grid-cols-6 gap-0.5 p-1 bg-black border-b border-gray-800 text-center flex-shrink-0 relative">
      <div className="flex flex-col items-center justify-center font-bold border-r border-gray-800 min-w-[48px]">
        <span className="text-[0.45rem] uppercase text-gray-400 flex flex-col items-center leading-tight">
          H. TRAB<span className="text-[0.35rem] text-gray-500">(1720/AÑO)</span>
        </span>
        <span className="text-[0.85rem] text-white mt-0.5">{horasTrabajadas}h</span>
      </div>
      
      <div className="flex flex-col items-center justify-center font-bold border-r border-gray-800 min-w-[48px] bg-[#ff9100]/15 border-dashed border-[#ff9100]/50 rounded cursor-pointer transition-colors active:bg-[#ff9100]/30">
        <span className="text-[0.45rem] uppercase text-[#ff9100] flex flex-col items-center leading-tight">
          EXTRAS ✎<span className="text-[0.35rem] text-gray-500">&nbsp;</span>
        </span>
        <span className="text-[0.85rem] text-white mt-0.5">{hExtraAnual.toFixed(1)}h</span>
      </div>

      <div className="flex flex-col items-center justify-center font-bold border-r border-gray-800 min-w-[48px] bg-[#ffea00]/15 border-dashed border-[#ffea00]/50 rounded cursor-pointer transition-colors active:bg-[#ffea00]/30" onClick={() => alert('Total de días de convenio (calculado del calendario)')}>
        <span className="text-[0.45rem] uppercase text-[#ffea00] flex flex-col items-center leading-tight">
          CONV ✎<span className="text-[0.35rem] text-gray-500">(2/AÑO)</span>
        </span>
        <span className="text-[0.85rem] text-white mt-0.5">{cConvAnual}</span>
      </div>

      <div className="flex flex-col items-center justify-center font-bold border-r border-gray-800 min-w-[48px] bg-[#00b0ff]/15 border-dashed border-[#00b0ff]/50 rounded cursor-pointer transition-colors active:bg-[#00b0ff]/30" onClick={() => alert('Total de días de adecuación (calculado del calendario)')}>
        <span className="text-[0.45rem] uppercase text-[#00b0ff] flex flex-col items-center leading-tight">
          ADEC ✎<span className="text-[0.35rem] text-gray-500">({cAdecAnual}/{adecTotal})</span>
        </span>
        <span className="text-[0.85rem] text-white mt-0.5">{cAdecAnual}</span>
      </div>

      <div className="flex flex-col items-center justify-center font-bold border-r border-gray-800 min-w-[48px] bg-[#ffd700]/15 border-dashed border-[#ffd700]/50 rounded cursor-pointer transition-colors active:bg-[#ffd700]/30" onClick={() => alert('Modificar Bolsa desde Configuración')}>
        <span className="text-[0.45rem] uppercase text-[#ffd700] flex flex-col items-center leading-tight">
          BOLSA ✎<span className="text-[0.35rem] text-gray-500">{year}</span>
        </span>
        <span className="text-[0.85rem] text-white mt-0.5">{bolsa}h</span>
      </div>

      <div className="flex flex-col items-center justify-center font-bold min-w-[48px]">
        <span className="text-[0.45rem] uppercase text-[#00e676] flex flex-col items-center leading-tight">
          VAC<span className="text-[0.35rem] text-gray-500">(30/AÑO)</span>
        </span>
        <span className="text-[0.85rem] text-white mt-0.5">{cVacAnual}</span>
      </div>
    </div>
  );
};
