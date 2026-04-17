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

export const ExtraHoursModal: React.FC<ExtraHoursModalProps> = ({ isOpen, onClose, dateStr, displayDate }) => {
  const { state, updateExtra } = useAppContext();
  const [hours, setHours] = useState('');

  useEffect(() => {
    if (isOpen) {
      setHours(state.extras[dateStr]?.toString() || '');
    }
  }, [isOpen, dateStr, state.extras]);

  const handleSave = () => {
    const val = parseFloat(hours.replace(',', '.'));
    updateExtra(dateStr, val);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1e1e1e] text-white border-gray-800 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-[#ff9100] text-xl">⏱️ ANOTAR HORAS EXTRA</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-4">
          <p className="text-gray-400 font-bold mb-4">{displayDate}</p>
          <Input
            type="number"
            step="0.1"
            placeholder="Ej: 2.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="text-center text-3xl h-16 bg-[#2a2a2a] border-gray-700 text-white mb-4"
          />
          <p className="text-xs text-gray-400 italic text-center mb-6">
            Pon número positivo para sumar o negativo para restar. Deja vacío o en 0 para borrar.
          </p>
          <div className="flex flex-col w-full gap-2">
            <Button onClick={handleSave} className="w-full bg-[#ff9100] hover:bg-[#ff9100]/80 text-black font-bold text-lg h-12">
              GUARDAR CAMBIOS
            </Button>
            <Button onClick={onClose} variant="secondary" className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold h-12">
              CANCELAR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
