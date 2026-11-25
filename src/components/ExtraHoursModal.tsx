import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAppContext } from '../context/AppContext';

interface ExtraHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  displayDate: string;
}

const PRESETS = [-2, -1, -0.5, 0.5, 1, 2, 7.75];

export const ExtraHoursModal: React.FC<ExtraHoursModalProps> = ({ isOpen, onClose, dateStr, displayDate }) => {
  const { state, updateExtra } = useAppContext();
  const [hours, setHours] = useState('');

  useEffect(() => {
    if (isOpen) {
      setHours(state.extras[dateStr]?.toString() || '');
    }
  }, [isOpen, dateStr, state.extras]);

  const handleSave = () => {
    const cleaned = hours.trim().replace(',', '.');
    const val = cleaned === '' ? 0 : parseFloat(cleaned);
    updateExtra(dateStr, Number.isFinite(val) ? val : 0);
    onClose();
  };

  const handlePreset = (val: number) => {
    updateExtra(dateStr, val);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1e1e1e] text-white border-gray-800 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-[#ff9100] text-xl font-black">⏱️ HORAS EXTRA</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-2">
          <p className="text-gray-400 font-bold mb-3">{displayDate}</p>
          <Input
            type="number"
            step="0.1"
            placeholder="Ej: 2.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="text-center text-3xl h-14 bg-[#2a2a2a] border-gray-700 text-white mb-3"
          />

          <div className="grid grid-cols-4 gap-1.5 w-full mb-4">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePreset(p)}
                className={`py-2 rounded text-xs font-black border transition-colors cursor-pointer ${
                  p > 0
                    ? 'bg-[#ff9100]/15 border-[#ff9100]/40 text-[#ff9100] hover:bg-[#ff9100]/30'
                    : 'bg-[#ff5252]/15 border-[#ff5252]/40 text-[#ff5252] hover:bg-[#ff5252]/30'
                }`}
              >
                {p > 0 ? `+${p}h` : `${p}h`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePreset(0)}
              className="py-2 rounded text-xs font-black border bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 cursor-pointer"
            >
              BORRAR
            </button>
          </div>

          <div className="flex flex-col w-full gap-2">
            <Button onClick={handleSave} className="w-full bg-[#ff9100] hover:bg-[#ff9100]/80 text-black font-bold text-base h-11">
              GUARDAR CAMBIOS
            </Button>
            <Button onClick={onClose} variant="secondary" className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold h-10">
              CANCELAR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
