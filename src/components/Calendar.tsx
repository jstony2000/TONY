import React from 'react';
import { useAppContext } from '../context/AppContext';
import { SHIFT_TYPES, COLORS } from '../lib/constants';
import { cn } from '../lib/utils';

interface CalendarProps {
  currentDate: Date;
  editMode: number;
  onDayClick: (dateStr: string, day: number, month: number, year: number) => void;
  isLandscapeMobile?: boolean;
}

export const Calendar: React.FC<CalendarProps> = ({ currentDate, editMode, onDayClick, isLandscapeMobile = false }) => {
  const { state } = useAppContext();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const firstDay = new Date(year, month, 1).getDay();
  const emptyDaysBefore = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysRender = [];
  for (let i = emptyDaysBefore - 1; i >= 0; i--) {
    daysRender.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysRender.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  const totalCells = emptyDaysBefore + daysInMonth;
  const emptyDaysAfter = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= emptyDaysAfter; d++) {
    daysRender.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
  }

  const numRows = Math.ceil(daysRender.length / 7);

  const getDayDetails = (dateStr: string) => {
    const type = state.data[dateStr] || 0;
    let cls = '';
    let label = 'LIBRE';
    let bgColor = COLORS.LIBRE;
    let textColor = '#888';

    switch (type) {
      case SHIFT_TYPES.NOCHE:
        cls = 'bg-[#2979ff] text-white';
        label = 'NOCHE';
        bgColor = COLORS.NOCHE;
        textColor = '#fff';
        break;
      case SHIFT_TYPES.FESTIVO:
        cls = 'bg-[#ff1744] text-white';
        label = 'FESTIVO';
        bgColor = COLORS.FESTIVO;
        textColor = '#fff';
        break;
      case SHIFT_TYPES.VACACIONES:
        cls = 'bg-[#00e676] text-black';
        label = 'VACAS';
        bgColor = COLORS.VACACIONES;
        textColor = '#000';
        break;
      case SHIFT_TYPES.CONVENIO:
        cls = 'bg-[#ffea00] text-black';
        label = 'CONV';
        bgColor = COLORS.CONVENIO;
        textColor = '#000';
        break;
      case SHIFT_TYPES.ADECUACION:
        cls = 'bg-[#00b0ff] text-black';
        label = 'ADEC';
        bgColor = COLORS.ADECUACION;
        textColor = '#000';
        break;
      case SHIFT_TYPES.DIA:
        cls = 'bg-white text-black border-2 border-gray-300';
        label = 'DÍA';
        bgColor = COLORS.DIA;
        textColor = '#000';
        break;
      default:
        cls = 'bg-[#1a1a1a] text-[#999]';
        break;
    }

    return { cls, label, bgColor, textColor };
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-black">
      <div className={cn(
        "grid grid-cols-7 text-center text-gray-400 font-black bg-black shrink-0",
        isLandscapeMobile ? "py-1 text-[10px] border-b border-gray-900" : "py-1.5 text-[11px] sm:text-xs"
      )}>
        <div><span className="hidden sm:inline">LUNES</span><span className="sm:hidden">LUN</span></div>
        <div><span className="hidden sm:inline">MARTES</span><span className="sm:hidden">MAR</span></div>
        <div><span className="hidden sm:inline">MIÉRCOLES</span><span className="sm:hidden">MIÉ</span></div>
        <div><span className="hidden sm:inline">JUEVES</span><span className="sm:hidden">JUE</span></div>
        <div><span className="hidden sm:inline">VIERNES</span><span className="sm:hidden">VIE</span></div>
        <div><span className="hidden sm:inline">SÁBADO</span><span className="sm:hidden">SÁB</span></div>
        <div><span className="hidden sm:inline">DOMINGO</span><span className="sm:hidden">DOM</span></div>
      </div>

      <div
        className={cn(
          "flex-1 min-h-0 grid grid-cols-7",
          isLandscapeMobile ? "gap-1 p-1" : "gap-1 p-1 sm:gap-1.5 sm:p-1.5"
        )}
        style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}
      >
        {daysRender.map((item, idx) => {
          const fy = item.date.getFullYear();
          const fm = item.date.getMonth();
          const fd = item.date.getDate();
          const dateStr = `${fy}-${String(fm + 1).padStart(2, '0')}-${String(fd).padStart(2, '0')}`;
          
          const { cls, label, bgColor, textColor } = getDayDetails(dateStr);
          const extraHours = state.extras[dateStr];
          
          const isToday = fy === today.getFullYear() && fm === today.getMonth() && fd === today.getDate();

          return (
            <div
              key={idx}
              onClick={() => onDayClick(dateStr, fd, fm, fy)}
              className={cn(
                "relative flex flex-col items-center justify-center min-h-0 h-full w-full rounded-lg transition-all select-none",
                cls,
                !item.isCurrentMonth && "opacity-35",
                isToday && "ring-[3px] sm:ring-[4px] ring-white z-[20] shadow-[0_0_15px_4px_rgba(255,255,255,0.28)] scale-[1.04]",
                editMode === 0 ? "cursor-default" : "cursor-pointer"
              )}
              style={{ backgroundColor: bgColor }}
            >
              {extraHours ? (
                <div className="absolute top-0.5 right-0.5 bg-[#ff9100] text-black text-[0.5rem] sm:text-[0.55rem] font-black px-1 rounded leading-tight">
                  +{extraHours}h
                </div>
              ) : null}
              <div
                className={cn(
                  "font-black leading-none",
                  isLandscapeMobile ? "text-base sm:text-lg" : "text-xl sm:text-2xl"
                )}
                style={{ color: textColor }}
              >
                {fd}
              </div>
              <div
                className={cn(
                  "font-black uppercase leading-none",
                  isLandscapeMobile ? "text-[0.48rem] mt-0.5" : "text-[0.52rem] sm:text-[0.55rem] mt-1"
                )}
                style={{ color: textColor === '#fff' ? '#fff' : textColor === '#000' ? '#000' : '#888' }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
