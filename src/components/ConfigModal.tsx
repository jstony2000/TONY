import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAppContext } from '../context/AppContext';
import { DEFAULT_CONFIG, SHIFT_TYPES } from '../lib/constants';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, currentDate }) => {
  const { state, updateConfig, applyPatron, updatePatron, updateStart, resetYear, importData } = useAppContext();
  const [year, setYear] = useState(currentDate.getFullYear().toString());
  const [month, setMonth] = useState(currentDate.getMonth().toString());
  
  const [config, setConfig] = useState<any>(DEFAULT_CONFIG);
  const [monthParams, setMonthParams] = useState({ irpf: 0, prima: 0, cobrarExtras: false });
  const [activeTab, setActiveTab] = useState('nomina');

  useEffect(() => {
    if (isOpen) {
      let y = currentDate.getFullYear();
      let m = currentDate.getMonth();

      // Mes vencido: retrocedemos un mes por defecto
      if (m === 0) {
        m = 11;
        y = y - 1;
      } else {
        m = m - 1;
      }

      setYear(y.toString());
      setMonth(m.toString());
      loadConfigForYear(y.toString(), m.toString());
    }
  }, [isOpen, currentDate]);

  const loadConfigForYear = (y: string, mOverride?: string) => {
    const conf = state.config[y] || state.config[Object.keys(state.config).sort().reverse()[0]] || DEFAULT_CONFIG;
    setConfig(conf);
    const m = mOverride !== undefined ? mOverride : month;
    const params = conf.mesesParams?.[m] || { irpf: conf.deduccion || 0, prima: 0, cobrarExtras: false };
    setMonthParams(params);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const y = e.target.value;
    setYear(y);
    loadConfigForYear(y);
  };

  const handleMonthChange = (val: string) => {
    setMonth(val);
    const params = config.mesesParams?.[val] || { irpf: config.deduccion || 0, prima: 0, cobrarExtras: false };
    setMonthParams(params);
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig({ ...config, [key]: value });
  };

  const handleMonthParamChange = (key: string, value: any) => {
    setMonthParams({ ...monthParams, [key]: value });
  };

  const saveConfig = () => {
    const newConfig = { ...config };
    if (!newConfig.mesesParams) newConfig.mesesParams = {};
    newConfig.mesesParams[month] = monthParams;
    updateConfig(year, newConfig);
    alert(`Datos guardados para el año ${year}`);
  };

  const handleApplyPatron = () => {
    if (!state.start) return;
    const refDate = new Date(state.start);
    const day = refDate.getDay();
    const diff = refDate.getDate() - day + (day === 0 ? -6 : 1);
    const refMonday = new Date(refDate.setDate(diff));
    applyPatron(parseInt(year), refMonday);
    alert(`Patrón aplicado al año ${year}`);
    onClose();
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        importData(imported);
        alert('Copia de seguridad cargada correctamente.');
        onClose();
      } catch (err) {
        alert('Error al leer el archivo.');
      }
    };
    reader.readAsText(file);
  };

  // Calculate payroll for the selected month
  const calculatePayroll = () => {
    const y = parseInt(year);
    if (isNaN(y)) return { hNoche: 0, hGarantia: 0, hFestivo: 0, hExtraMes: 0, impBase: 0, impNoche: 0, impGarantia: 0, impFestivo: 0, impOtros: 0, impPagaExtra: 0, impExtras: 0, valPrima: 0, totalBruto: 0, totalDeduccion: 0, liquido: 0 };
    const m = parseInt(month);
    let cN = 0, cF = 0, hExtraMes = 0;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const v = state.data[k] || 0;
      if (v === SHIFT_TYPES.NOCHE) cN++;
      if (v === SHIFT_TYPES.FESTIVO) { cN++; cF++; }
      if (state.extras[k]) hExtraMes += Number(state.extras[k]) || 0;
    }

    const hNoche = cN * 7.75;
    const hGarantia = cN * 3.75; // K75 se calcula a 3.75h garantizadas por cada noche trabajada
    const hFestivo = cF * 7.75;
    
    const impBase = Number(config.salario) || 0;
    const impNoche = hNoche * (Number(config.noche) || 0);
    const impGarantia = hGarantia * (Number(config.garantia) || 0);
    const impFestivo = hFestivo * (Number(config.festivo) || 0);
    const impOtros = Number(config.otros) || 0;
    const impPagaExtra = (m === 5 || m === 11) ? (Number(config.pagaExtra) || 0) : 0; // 5 is June, 11 is Dec
    
    let impExtras = 0;
    if (hExtraMes !== 0 && monthParams.cobrarExtras) {
      impExtras = hExtraMes * (Number(config.precioExtra) || 20);
    }
    
    const valPrima = Number(monthParams.prima) || 0;

    const totalBruto = impBase + impNoche + impGarantia + impFestivo + impPagaExtra + impOtros + impExtras + valPrima;
    const totalDeduccion = totalBruto * (Number(monthParams.irpf) || 0);
    const liquido = totalBruto - totalDeduccion;

    return {
      hNoche, hGarantia, hFestivo, hExtraMes,
      impBase, impNoche, impGarantia, impFestivo, impOtros, impPagaExtra, impExtras, valPrima,
      totalBruto, totalDeduccion, liquido
    };
  };

  const calculateAnnualEstimates = () => {
    let totalBrutoAnual = 0;
    let totalDeduccionAnual = 0;
    const y = parseInt(year);
    if (isNaN(y)) return { bruto: 0, neto: 0 };
    
    for (let currentM = 0; currentM < 12; currentM++) {
      let cN = 0, cF = 0, hExtraM = 0;
      const daysInMonth = new Date(y, currentM + 1, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const k = `${y}-${String(currentM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const v = state.data[k] || 0;
        if (v === SHIFT_TYPES.NOCHE) cN++;
        if (v === SHIFT_TYPES.FESTIVO) { cN++; cF++; }
        if (state.extras[k]) hExtraM += Number(state.extras[k]) || 0;
      }
      
      const vNoche = cN * 7.75;
      const vGarantia = cN * 3.75;
      const vFestivo = cF * 7.75;
      
      const iBase = Number(config.salario) || 0;
      const iNoche = vNoche * (Number(config.noche) || 0);
      const iGarantia = vGarantia * (Number(config.garantia) || 0);
      const iFestivo = vFestivo * (Number(config.festivo) || 0);
      const iOtros = Number(config.otros) || 0;
      const iPagaExtra = (currentM === 5 || currentM === 11) ? (Number(config.pagaExtra) || 0) : 0;
      
      const p = config.mesesParams?.[currentM.toString()] || { irpf: config.deduccion || 0, prima: 0, cobrarExtras: false };
      
      let iExtras = 0;
      if (hExtraM !== 0 && p.cobrarExtras) {
        iExtras = hExtraM * (Number(config.precioExtra) || 20);
      }
      
      const vPrima = Number(p.prima) || 0;

      const mBruto = iBase + iNoche + iGarantia + iFestivo + iPagaExtra + iOtros + iExtras + vPrima;
      const mDeduccion = mBruto * (Number(p.irpf) || 0);
      
      totalBrutoAnual += mBruto;
      totalDeduccionAnual += mDeduccion;
    }
    
    return {
      bruto: totalBrutoAnual,
      neto: totalBrutoAnual - totalDeduccionAnual
    };
  };

  const payroll = calculatePayroll();
  const annualEstimates = calculateAnnualEstimates();
  const fmtM = (n: number) => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtN = (n: number) => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderPatternGrid = () => {
    if (!state.start) return null;
    const refDate = new Date(state.start);
    const day = refDate.getDay();
    const diff = refDate.getDate() - day + (day === 0 ? -6 : 1);
    const refMonday = new Date(refDate.setDate(diff));

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const cd = new Date(refMonday);
      cd.setDate(refMonday.getDate() + i);
      const isWork = state.patron[i] !== 1;
      cells.push(
        <div
          key={i}
          onClick={() => updatePatron(i, isWork ? 1 : 0)}
          className={`flex flex-col items-center justify-center h-10 cursor-pointer font-bold text-sm text-white ${isWork ? 'bg-[#2979ff]' : 'bg-[#1a1a1a]'}`}
        >
          <span className="text-[0.55em] text-gray-400 mb-0.5">{cd.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}</span>
          <span>{cd.getDate()}</span>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-px bg-gray-800 border border-gray-700 rounded overflow-hidden">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="bg-black text-gray-400 text-center text-xs py-1 font-bold">{d}</div>)}
        {cells}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1e1e1e] text-white border-gray-800 w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto px-4 sm:px-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-800">
          <DialogTitle className="flex items-center text-xl font-black">
            ⚙️ AÑO: 
            <Input 
              type="number" 
              value={year} 
              onChange={handleYearChange} 
              className="w-24 ml-3 bg-[#2a2a2a] border-gray-600 text-center text-lg h-9 font-mono" 
            />
          </DialogTitle>
        </DialogHeader>

        <div className="w-full mt-4 flex flex-col gap-4">
          {/* Custom Tabs List */}
          <div className="grid w-full grid-cols-4 bg-[#222] rounded-md overflow-hidden p-1 shadow-inner">
            {['nomina', 'precios', 'turnos', 'datos'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`py-2 text-[10px] sm:text-xs font-bold uppercase transition-colors rounded ${
                  activeTab === t 
                    ? 'bg-[#1e1e1e] text-[#2979ff] shadow-sm' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {activeTab === 'nomina' && (
            <div className="space-y-4 fade-in">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs text-gray-400">MES:</Label>
                <Select value={month} onValueChange={handleMonthChange}>
                  <SelectTrigger className="bg-[#333] border-gray-600">
                    <SelectValue>
                      {["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"][parseInt(month)]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[#333] border-gray-600 text-white">
                    {["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"].map((m, i) => (
                      <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs text-gray-400">% IRPF+SS DEL MES:</Label>
                <Input 
                  type="number" 
                  step="0.0001" 
                  value={monthParams.irpf} 
                  onChange={(e) => handleMonthParamChange('irpf', parseFloat(e.target.value))}
                  className="bg-[#333] border-gray-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#222] p-2 rounded">
              <input 
                type="checkbox" 
                id="cobrarExtras" 
                checked={monthParams.cobrarExtras} 
                onChange={(e) => handleMonthParamChange('cobrarExtras', e.target.checked)}
                className="w-5 h-5 ml-1"
              />
              <Label htmlFor="cobrarExtras" className="text-sm font-bold cursor-pointer">Cobrar Horas Extra este mes (Si no, a Bolsa)</Label>
            </div>

            <div className="bg-[#222] p-2 rounded">
              <Label className="text-xs text-gray-400 mb-1 block">PRIMA / ATRASOS DEL MES (€):</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="Ej: 1200.50" 
                value={monthParams.prima || ''} 
                onChange={(e) => handleMonthParamChange('prima', parseFloat(e.target.value))}
                className="bg-[#333] border-gray-600"
              />
            </div>

            <Button onClick={saveConfig} className="w-full bg-[#2979ff] hover:bg-blue-600">GUARDAR CONFIGURACIÓN DEL MES</Button>

            <div className="bg-white text-black p-3 sm:p-4 rounded font-mono text-[11px] sm:text-[13px] border border-gray-300 mt-4 overflow-x-auto">
              <div className="text-center font-bold text-[13px] sm:text-base border-b-2 border-black pb-2 mb-2 uppercase">
                SIMULACIÓN NÓMINA - {["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"][parseInt(month) || 0]} {year}
              </div>
              <table className="w-full text-right border-collapse table-fixed">
                <thead>
                  <tr className="text-gray-600 border-b border-black text-[9px] sm:text-[11px]">
                    <th className="text-left py-1 w-[40%]">CONCEPTO</th>
                    <th className="py-1 w-[18%] text-center">UNID.</th>
                    <th className="py-1 w-[20%] text-center">PRECIO</th>
                    <th className="py-1 w-[22%] text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="text-left font-bold py-1.5 break-words leading-tight pr-1">Salario Base</td>
                    <td className="py-1.5 text-center">30.00</td>
                    <td className="py-1.5 text-center">-</td>
                    <td className="py-1.5 text-right">{fmtM(payroll.impBase)} €</td>
                  </tr>
                  {payroll.impPagaExtra > 0 && (
                    <tr>
                      <td className="text-left font-bold py-1.5 break-words leading-tight pr-1">Paga Extra</td>
                      <td className="py-1.5 text-center">1.00</td>
                      <td className="py-1.5 text-center">{fmtM(config.pagaExtra)} €</td>
                      <td className="py-1.5 text-right">{fmtM(payroll.impPagaExtra)} €</td>
                    </tr>
                  )}
                  <tr>
                    <td className="text-left font-bold py-1.5 break-words leading-tight pr-1">P. Nocturnidad</td>
                    <td className="py-1.5 text-center">{fmtN(payroll.hNoche)}</td>
                    <td className="py-1.5 text-center">{fmtM(config.noche)} €</td>
                    <td className="py-1.5 text-right">{fmtM(payroll.impNoche)} €</td>
                  </tr>
                  <tr>
                    <td className="text-left font-bold py-1.5 break-words leading-tight pr-1">Garantía K75</td>
                    <td className="py-1.5 text-center">{fmtN(payroll.hGarantia)}</td>
                    <td className="py-1.5 text-center">{fmtM(config.garantia)} €</td>
                    <td className="py-1.5 text-right">{fmtM(payroll.impGarantia)} €</td>
                  </tr>
                  <tr>
                    <td className="text-left font-bold py-1.5 break-words leading-tight pr-1">Festivo KA9</td>
                    <td className="py-1.5 text-center">{fmtN(payroll.hFestivo)}</td>
                    <td className="py-1.5 text-center">{fmtM(config.festivo)} €</td>
                    <td className="py-1.5 text-right">{fmtM(payroll.impFestivo)} €</td>
                  </tr>
                  {payroll.impOtros > 0 && (
                    <tr>
                      <td className="text-left font-bold py-1.5 break-words leading-tight pr-1">Otros Pluses</td>
                      <td className="py-1.5 text-center">1.00</td>
                      <td className="py-1.5 text-center">-</td>
                      <td className="py-1.5 text-right">{fmtM(payroll.impOtros)} €</td>
                    </tr>
                  )}
                  {payroll.hExtraMes > 0 && (
                    <tr>
                      <td className="text-left font-bold py-1.5 break-words leading-tight pr-1">H. Extra {monthParams.cobrarExtras ? '(Cobro)' : '(Bolsa)'}</td>
                      <td className="py-1.5 text-center">{payroll.hExtraMes.toFixed(2)}</td>
                      <td className="py-1.5 text-center">{monthParams.cobrarExtras ? `${fmtM(config.precioExtra)} €` : '-'}</td>
                      <td className="py-1.5 text-right">{monthParams.cobrarExtras ? `${fmtM(payroll.impExtras)} €` : '(0,00 €)'}</td>
                    </tr>
                  )}
                  {payroll.valPrima > 0 && (
                    <tr>
                      <td className="text-left font-bold py-1.5 break-words leading-tight pr-1">Prima / Atrasos</td>
                      <td className="py-1.5 text-center">1.00</td>
                      <td className="py-1.5 text-center">-</td>
                      <td className="py-1.5 text-right">{fmtM(payroll.valPrima)} €</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="mt-4 border-t-2 border-black pt-2 flex flex-col gap-1">
                <div className="flex justify-between items-center text-[12px] sm:text-[14px]">
                  <span>TOTAL DEVENGADO</span>
                  <span className="font-bold">{fmtM(payroll.totalBruto)} €</span>
                </div>
                <div className="flex justify-between items-center text-red-600 text-[12px] sm:text-[14px]">
                  <span>DEDUCCIONES (SS+IRPF)</span>
                  <span className="font-bold">-{fmtM(payroll.totalDeduccion)} €</span>
                </div>
                <div className="flex justify-between items-center font-black text-sm sm:text-base mt-2 border-t border-dashed border-black pt-2">
                  <span>LÍQUIDO A PERCIBIR</span>
                  <span>{fmtM(payroll.liquido)} €</span>
                </div>
              </div>
            </div>

            <Button onClick={() => window.print()} className="w-full bg-[#00e676] hover:bg-green-500 text-black font-bold mt-2">🖨️ EXPORTAR PDF / IMPRIMIR</Button>

            <div className="bg-black border border-gray-800 rounded p-4 text-center mt-2 shadow-inner">
              <div className="text-xs text-gray-400 font-bold mb-1 tracking-wider uppercase">Proyección Anual Estimada</div>
              <div className="text-2xl font-black text-[#00e676] mb-1">{fmtM(annualEstimates.bruto)} €</div>
              <div className="text-sm text-gray-300 font-mono">{fmtM(annualEstimates.neto)} € (Neto)</div>
            </div>
          </div>
          )}

          {activeTab === 'precios' && (
          <div className="space-y-3 overflow-y-auto fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Salario Mensual (Base):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={config.salario} onChange={(e) => handleConfigChange('salario', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Salario base reflejado en nómina (sin prorratas de pagas extra).</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Importe Paga Extra:</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={config.pagaExtra} onChange={(e) => handleConfigChange('pagaExtra', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Importe íntegro que se cobra en las pagas de junio y diciembre.</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Hora Noche (K05):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.0001" value={config.noche} onChange={(e) => handleConfigChange('noche', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Plus salarial por cada hora trabajada en turno de noche.</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Garantía (K75):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.0001" value={config.garantia} onChange={(e) => handleConfigChange('garantia', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Plus de garantía por noches. Se suele sumar media hora por cada hora de noche.</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Festivo (KA9):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.0001" value={config.festivo} onChange={(e) => handleConfigChange('festivo', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Plus devengado por cada hora trabajada en día festivo.</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Hora Extra (€):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={config.precioExtra} onChange={(e) => handleConfigChange('precioExtra', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Precio aproximado al que se te abonan las horas extra que prefieres cobrar.</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Otros Complementos (K70, etc.):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={config.otros} onChange={(e) => handleConfigChange('otros', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Suma de otros pluses fijos como K70, plus toxicidad o penosidad.</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Meses de cobro (Otros):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="1" min="0" max="12" value={config.mesesOtros !== undefined ? config.mesesOtros : 12} onChange={(e) => handleConfigChange('mesesOtros', parseInt(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">¿Cuántos meses al año cobras esos otros complementos? (Ej: 11 (agosto vacas) o 12).</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-red-500 mb-1 block">% IRPF + SS (Base Anual):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.001" value={config.deduccion} onChange={(e) => handleConfigChange('deduccion', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Retención estimada total (IRPF + contingencias). Ej: 0.2709 (para 27.09%). Modificable por mes arriba.</p>
              </div>
            </div>
            <Button onClick={saveConfig} className="w-full bg-[#2979ff] hover:bg-blue-600 mt-4 text-white font-bold tracking-wider">GUARDAR DATOS DEL AÑO</Button>
          </div>
          )}

          {activeTab === 'turnos' && (
          <div className="space-y-4 fade-in">
            <div>
              <Label className="text-xs">Fecha Inicio Ciclo:</Label>
              <Input type="date" value={state.start} onChange={(e) => updateStart(e.target.value)} className="bg-[#2a2a2a] border-gray-600" />
            </div>
            <div className="border border-gray-700 p-2 rounded-lg bg-[#111]">
              <div className="flex justify-center gap-4 mb-2 text-xs font-bold bg-[#222] p-2 rounded">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#2979ff]"></div>TRABAJO</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#1a1a1a] border border-gray-600"></div>LIBRE</div>
              </div>
              {renderPatternGrid()}
            </div>
            <Button onClick={handleApplyPatron} className="w-full bg-[#2979ff] hover:bg-blue-600">APLICAR PATRÓN AL AÑO</Button>
            <Button onClick={() => { if(confirm(`¿Borrar datos de ${year}?`)) { resetYear(parseInt(year)); onClose(); } }} variant="destructive" className="w-full">BORRAR AÑO COMPLETO</Button>
          </div>
          )}

          {activeTab === 'datos' && (
          <div className="space-y-4 fade-in">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-[#ffd700]">BOLSA DE HORAS (Oficial del Año):</Label>
                <Input type="number" step="0.1" value={config.bolsa} onChange={(e) => handleConfigChange('bolsa', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600" />
              </div>
              <div>
                <Label className="text-xs text-[#ff9100]">HORAS EXTRA (Base arrastrada):</Label>
                <Input type="number" step="0.1" value={config.extraBase} onChange={(e) => handleConfigChange('extraBase', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600" />
              </div>
              <div>
                <Label className="text-xs text-[#00b0ff]">SALDO ADEC TOTAL (Días por año):</Label>
                <Input type="number" step="1" value={config.adecTotal} onChange={(e) => handleConfigChange('adecTotal', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600" />
              </div>
              <Button onClick={saveConfig} className="w-full bg-[#2979ff] hover:bg-blue-600">GUARDAR DATOS DEL AÑO</Button>
            </div>
            <hr className="border-gray-700" />
            <div className="space-y-2">
              <Button onClick={handleBackup} className="w-full bg-gray-700 hover:bg-gray-600">💾 GUARDAR COPIA DE SEGURIDAD (.JSON)</Button>
              <div className="relative">
                <Input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Button className="w-full bg-gray-800 border border-gray-600 hover:bg-gray-700 pointer-events-none">📂 CARGAR COPIA...</Button>
              </div>
            </div>
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
