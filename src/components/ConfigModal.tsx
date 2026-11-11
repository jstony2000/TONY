import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAppContext } from '../context/AppContext';
import { DEFAULT_CONFIG, SHIFT_TYPES, APP_VERSION } from '../lib/constants';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
}

const R2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, currentDate }) => {
  const { state, updateConfig, applyPatron, updatePatron, updateStart, resetYear, importData } = useAppContext();
  const [year, setYear] = useState(currentDate.getFullYear().toString());
  const [month, setMonth] = useState(currentDate.getMonth().toString());
  
  const [config, setConfig] = useState<any>(DEFAULT_CONFIG);
  const [monthParams, setMonthParams] = useState<any>({
    irpf: 20.64,
    prima: 0,
    otrosMes: '',
    ajusteNeto: 0,
    hNocheManual: '',
    hFestivoManual: '',
    cobrarExtras: false
  });
  const [activeTab, setActiveTab] = useState('nomina');
  const [isEditingYear, setIsEditingYear] = useState(false);

  // Convierte automáticamente porcentajes antiguos (ej. 0.2714 -> 20.64%)
  const normalizeIrpf = (val: any, fallback: any) => {
    const raw = val !== undefined && val !== '' ? Number(val) : (Number(fallback) || 20.64);
    if (raw > 0 && raw < 1) {
      return R2(Math.max(0, (raw - 0.065) * 100));
    }
    return raw;
  };

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
    const rawConf = state.config[y] || state.config[Object.keys(state.config).sort().reverse()[0]] || DEFAULT_CONFIG;
    const conf = {
      ...DEFAULT_CONFIG,
      ...rawConf,
      noche: Number(rawConf.noche) === 3.1517 ? 3.151789 : (rawConf.noche ?? 3.151789),
      prorrataSS: rawConf.prorrataSS !== undefined ? rawConf.prorrataSS : 443.18,
      f99: rawConf.f99 !== undefined ? rawConf.f99 : 1.22,
    };
    setConfig(conf);
    const m = mOverride !== undefined ? mOverride : month;
    const saved = conf.mesesParams?.[m] || {};
    setMonthParams({
      irpf: normalizeIrpf(saved.irpf, conf.deduccion),
      prima: saved.prima || 0,
      otrosMes: saved.otrosMes !== undefined ? saved.otrosMes : '',
      ajusteNeto: saved.ajusteNeto || 0,
      hNocheManual: saved.hNocheManual !== undefined ? saved.hNocheManual : '',
      hFestivoManual: saved.hFestivoManual !== undefined ? saved.hFestivoManual : '',
      cobrarExtras: Boolean(saved.cobrarExtras)
    });
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const y = e.target.value;
    setYear(y);
    loadConfigForYear(y);
  };

  const handleMonthChange = (val: string) => {
    setMonth(val);
    const saved = config.mesesParams?.[val] || {};
    setMonthParams({
      irpf: normalizeIrpf(saved.irpf, config.deduccion),
      prima: saved.prima || 0,
      otrosMes: saved.otrosMes !== undefined ? saved.otrosMes : '',
      ajusteNeto: saved.ajusteNeto || 0,
      hNocheManual: saved.hNocheManual !== undefined ? saved.hNocheManual : '',
      hFestivoManual: saved.hFestivoManual !== undefined ? saved.hFestivoManual : '',
      cobrarExtras: Boolean(saved.cobrarExtras)
    });
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

  const calculatePayrollForMonth = (y: number, m: number, customParams?: any) => {
    let cN = 0, cF = 0, hExtraMes = 0;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const v = state.data[k] || 0;
      if (v === SHIFT_TYPES.NOCHE) cN++;
      if (v === SHIFT_TYPES.FESTIVO) { cN++; cF++; }
      if (state.extras[k]) hExtraMes += Number(state.extras[k]) || 0;
    }

    const p = customParams || config.mesesParams?.[m.toString()] || {};
    const irpfPct = normalizeIrpf(p.irpf, config.deduccion);

    const hNoche = p.hNocheManual !== undefined && p.hNocheManual !== '' ? Number(p.hNocheManual) : R2(cN * 7.75);
    const hGarantia = R2((hNoche / 7.75) * 3.75);
    const hFestivo = p.hFestivoManual !== undefined && p.hFestivoManual !== '' ? Number(p.hFestivoManual) : R2(cF * 7.75);
    
    const impBase = R2(Number(config.salario) || 2516.37);
    const impNoche = R2(hNoche * (Number(config.noche) || 3.151789));
    const impGarantia = R2(hGarantia * (Number(config.garantia) || 2.2909));
    const impFestivo = R2(hFestivo * (Number(config.festivo) || 7.9452));
    
    const mesesOtros = config.mesesOtros !== undefined ? Number(config.mesesOtros) : 12;
    const defaultOtros = (mesesOtros === 11 && m === 7) ? 0 : (Number(config.otros) || 0);
    const impOtros = p.otrosMes !== undefined && p.otrosMes !== '' ? R2(Number(p.otrosMes)) : R2(defaultOtros);
    
    const impPagaExtra = (m === 5 || m === 11) ? R2(Number(config.pagaExtra) || 0) : 0;
    
    let impExtras = 0;
    if (hExtraMes !== 0 && p.cobrarExtras) {
      impExtras = R2(hExtraMes * (Number(config.precioExtra) || 20));
    }
    
    const valPrima = R2(Number(p.prima) || 0);
    const ajusteNeto = R2(Number(p.ajusteNeto) || 0);

    const totalBruto = R2(impBase + impNoche + impGarantia + impFestivo + impPagaExtra + impOtros + impExtras + valPrima);
    
    // Motor Fiscal Stellantis: IRPF sobre Devengos + Seg. Social (6.50% por tramos) sobre Base de Cotización
    const prorrataSS = Number(config.prorrataSS !== undefined ? config.prorrataSS : 443.18);
    const f99 = Number(config.f99 !== undefined ? config.f99 : 1.22);
    const baseSS = R2((totalBruto - impPagaExtra) + prorrataSS);
    
    const cuotaIRPF = R2(totalBruto * (irpfPct / 100));
    const cuotaSS = R2(
      R2(baseSS * 0.047) +
      R2(baseSS * 0.0155) +
      R2(baseSS * 0.001) +
      R2(baseSS * 0.0015)
    );
    
    const totalDeduccion = R2(cuotaIRPF + cuotaSS + f99);
    const liquido = R2(totalBruto - totalDeduccion + ajusteNeto);

    return {
      hNoche, hGarantia, hFestivo, hExtraMes,
      impBase, impNoche, impGarantia, impFestivo, impOtros, impPagaExtra, impExtras, valPrima,
      baseSS, cuotaIRPF, cuotaSS, f99, irpfPct, ajusteNeto,
      totalBruto, totalDeduccion, liquido
    };
  };

  const calculatePayroll = () => {
    const y = parseInt(year);
    if (isNaN(y)) return calculatePayrollForMonth(2026, 0, monthParams);
    return calculatePayrollForMonth(y, parseInt(month), monthParams);
  };

  const calculateAnnualEstimates = () => {
    let totalBrutoAnual = 0;
    let totalNetoAnual = 0;
    const y = parseInt(year);
    if (isNaN(y)) return { bruto: 0, neto: 0 };
    
    for (let currentM = 0; currentM < 12; currentM++) {
      const p = currentM === parseInt(month) ? monthParams : undefined;
      const res = calculatePayrollForMonth(y, currentM, p);
      totalBrutoAnual = R2(totalBrutoAnual + res.totalBruto);
      totalNetoAnual = R2(totalNetoAnual + res.liquido);
    }
    
    return {
      bruto: totalBrutoAnual,
      neto: totalNetoAnual
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
      <DialogContent className="bg-[#1e1e1e] text-white border-gray-800 w-[95vw] max-w-5xl max-h-[95vh] overflow-y-auto px-4 sm:px-8">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-800">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <span>⚙️ AÑO:</span>
            <div 
              onClick={() => setIsEditingYear(true)}
              className="px-3 py-1 bg-[#2a2a2a] border border-gray-700 rounded-md font-mono text-lg cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-center min-w-[80px] h-9"
            >
              {isEditingYear ? (
                <input 
                  autoFocus
                  type="number" 
                  value={year} 
                  onChange={handleYearChange}
                  onBlur={() => setIsEditingYear(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingYear(false)}
                  className="w-20 bg-transparent border-none text-center focus:outline-none focus:ring-0 p-0 m-0" 
                />
              ) : (
                year
              )}
            </div>
            <span className="text-[10px] font-mono bg-[#2979ff]/20 text-[#2979ff] border border-[#2979ff]/50 px-2 py-0.5 rounded">
              {APP_VERSION}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="w-full mt-4 flex flex-col gap-4">
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
                  <Label className="text-xs text-gray-400">MES DE NÓMINA:</Label>
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
                  <Label className="text-xs text-gray-400">% IRPF DEL MES (Ej: 20.64):</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={monthParams.irpf} 
                    onChange={(e) => handleMonthParamChange('irpf', parseFloat(e.target.value))}
                    className="bg-[#333] border-gray-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-[#222] p-2 rounded">
                  <Label className="text-xs text-gray-400 mb-1 block">FIJOS MES (K70+KEA+Transp €):</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder={`Base: ${config.otros || 38.37} €`} 
                    value={monthParams.otrosMes} 
                    onChange={(e) => handleMonthParamChange('otrosMes', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="bg-[#333] border-gray-600"
                  />
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
                <div className="bg-[#222] p-2 rounded">
                  <Label className="text-xs text-gray-400 mb-1 block">AJUSTE NETO / COMEDOR (€):</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="Ej: 1.98 (KG5 - U27)" 
                    value={monthParams.ajusteNeto || ''} 
                    onChange={(e) => handleMonthParamChange('ajusteNeto', parseFloat(e.target.value))}
                    className="bg-[#333] border-gray-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#222] p-2 rounded">
                  <Label className="text-[11px] text-gray-400 mb-1 block">H. NOCHE MANUAL (Opcional):</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="Auto por calendario" 
                    value={monthParams.hNocheManual} 
                    onChange={(e) => handleMonthParamChange('hNocheManual', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="bg-[#333] border-gray-600"
                  />
                </div>
                <div className="bg-[#222] p-2 rounded">
                  <Label className="text-[11px] text-gray-400 mb-1 block">H. FESTIVO MANUAL (Opcional):</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="Auto por calendario" 
                    value={monthParams.hFestivoManual} 
                    onChange={(e) => handleMonthParamChange('hFestivoManual', e.target.value === '' ? '' : parseFloat(e.target.value))}
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

              <Button onClick={saveConfig} className="w-full bg-[#2979ff] hover:bg-blue-600 font-bold">GUARDAR CONFIGURACIÓN DEL MES</Button>

              <div className="bg-white text-black p-3 sm:p-4 rounded font-mono text-[11px] sm:text-[13px] border border-gray-300 mt-4 overflow-x-auto shadow-md">
                <div className="text-center font-bold text-[13px] sm:text-base border-b-2 border-black pb-2 mb-2 uppercase">
                  SIMULACIÓN NÓMINA - {["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"][parseInt(month) || 0]} {year}
                </div>
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="text-gray-600 border-b border-black text-[10px] sm:text-[11px]">
                      <th className="text-left py-1 pr-2">CONCEPTO</th>
                      <th className="py-1 px-1 text-center min-w-[50px]">UNID.</th>
                      <th className="py-1 px-1 text-center min-w-[70px]">PRECIO</th>
                      <th className="py-1 pl-2 text-right min-w-[90px]">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="text-left font-bold py-1.5 pr-2">Salario Base (G60)</td>
                      <td className="py-1.5 px-1 text-center font-mono">30,00</td>
                      <td className="py-1.5 px-1 text-center">83,88</td>
                      <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impBase)} €</td>
                    </tr>
                    {payroll.impPagaExtra > 0 && (
                      <tr>
                        <td className="text-left font-bold py-1.5 pr-2">Paga Extra</td>
                        <td className="py-1.5 px-1 text-center font-mono">1,00</td>
                        <td className="py-1.5 px-1 text-center font-mono">{fmtM(config.pagaExtra)}</td>
                        <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impPagaExtra)} €</td>
                      </tr>
                    )}
                    <tr>
                      <td className="text-left font-bold py-1.5 pr-2">Plus Nocturnidad (K05)</td>
                      <td className="py-1.5 px-1 text-center font-mono">{fmtN(payroll.hNoche)}</td>
                      <td className="py-1.5 px-1 text-center font-mono text-gray-600">{fmtM(config.noche)}</td>
                      <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impNoche)} €</td>
                    </tr>
                    <tr>
                      <td className="text-left font-bold py-1.5 pr-2">Garantía (K75)</td>
                      <td className="py-1.5 px-1 text-center font-mono">{fmtN(payroll.hGarantia)}</td>
                      <td className="py-1.5 px-1 text-center font-mono text-gray-600">{fmtM(config.garantia)}</td>
                      <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impGarantia)} €</td>
                    </tr>
                    <tr>
                      <td className="text-left font-bold py-1.5 pr-2">Festivo (KA9)</td>
                      <td className="py-1.5 px-1 text-center font-mono">{fmtN(payroll.hFestivo)}</td>
                      <td className="py-1.5 px-1 text-center font-mono text-gray-600">{fmtM(config.festivo)}</td>
                      <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impFestivo)} €</td>
                    </tr>
                    {payroll.impOtros > 0 && (
                      <tr>
                        <td className="text-left font-bold py-1.5 pr-2">Fijos (K70, KEA, Transp)</td>
                        <td className="py-1.5 px-1 text-center font-mono">1,00</td>
                        <td className="py-1.5 px-1 text-center">-</td>
                        <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impOtros)} €</td>
                      </tr>
                    )}
                    {payroll.hExtraMes !== 0 && (
                      <tr>
                        <td className="text-left font-bold py-1.5 pr-2 leading-tight">H. Extra {monthParams.cobrarExtras ? '(Cobro)' : '(Bolsa)'}</td>
                        <td className="py-1.5 px-1 text-center font-mono">{payroll.hExtraMes.toFixed(2)}</td>
                        <td className="py-1.5 px-1 text-center font-mono text-gray-600">{monthParams.cobrarExtras ? fmtM(config.precioExtra) : '-'}</td>
                        <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{monthParams.cobrarExtras ? `${fmtM(payroll.impExtras)} €` : '(0,00 €)'}</td>
                      </tr>
                    )}
                    {payroll.valPrima > 0 && (
                      <tr>
                        <td className="text-left font-bold py-1.5 pr-2">Prima / Atrasos</td>
                        <td className="py-1.5 px-1 text-center font-mono">1,00</td>
                        <td className="py-1.5 px-1 text-center">-</td>
                        <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.valPrima)} €</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="mt-4 border-t-2 border-black pt-2 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[12px] sm:text-[14px]">
                    <span>(A) TOTAL DEVENGOS</span>
                    <span className="font-bold">{fmtM(payroll.totalBruto)} €</span>
                  </div>
                  <div className="flex justify-between items-center text-red-600 text-[11px] sm:text-[13px]">
                    <span>IRPF ({fmtM(payroll.irpfPct)}%) + F99 ({fmtM(payroll.f99)} €)</span>
                    <span className="font-bold">-{fmtM(payroll.cuotaIRPF + payroll.f99)} €</span>
                  </div>
                  <div className="flex justify-between items-center text-red-600 text-[11px] sm:text-[13px]">
                    <span>Seg. Social (6,50% s/ Base {fmtM(payroll.baseSS)} €)</span>
                    <span className="font-bold">-{fmtM(payroll.cuotaSS)} €</span>
                  </div>
                  <div className="flex justify-between items-center text-red-700 text-[12px] sm:text-[13px] border-t border-gray-300 pt-1">
                    <span>(B) TOTAL COTIZ. + RETENC.</span>
                    <span className="font-bold">-{fmtM(payroll.totalDeduccion)} €</span>
                  </div>
                  {payroll.ajusteNeto !== 0 && (
                    <div className="flex justify-between items-center text-blue-700 text-[11px] sm:text-[13px]">
                      <span>Ajuste Neto / Comedor (KG5 - U27)</span>
                      <span className="font-bold">{payroll.ajusteNeto > 0 ? '+' : ''}{fmtM(payroll.ajusteNeto)} €</span>
                    </div>
                  )}
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
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Salario Mensual (Base G60):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={config.salario} onChange={(e) => handleConfigChange('salario', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Salario base reflejado en nómina (2516.37 €).</p>
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
                  <Input type="number" step="0.000001" value={config.noche} onChange={(e) => handleConfigChange('noche', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Ratio exacto Stellantis: 3.151789 €/h (268.69 € / 85.25h).</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Garantía (K75):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.0001" value={config.garantia} onChange={(e) => handleConfigChange('garantia', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Plus de garantía por noches: 2.2909 € (3.75 u. por noche).</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Festivo (KA9):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.0001" value={config.festivo} onChange={(e) => handleConfigChange('festivo', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Plus devengado por cada hora trabajada en sábado/domingo/festivo: 7.9452 €.</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Hora Extra (€):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={config.precioExtra} onChange={(e) => handleConfigChange('precioExtra', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Precio al que se abonan las horas extra cobradas.</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Fijos Habituales (K70 + KEA + Transp):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={config.otros} onChange={(e) => handleConfigChange('otros', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Ej. Agosto: 38.37 € (K70 16.96 + KEA 17.77 + Transp 3.64).</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-[#2979ff] mb-1 block">Prorrata + Extras Base SS (€):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={config.prorrataSS} onChange={(e) => handleConfigChange('prorrataSS', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Suma sobre devengo para Base SS: 443.18 € (Prorrata 419.40 + Especie 5.89 + Prorrata Sup 15.65 + VivoFácil 2.24).</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-red-500 mb-1 block">% IRPF Base Anual (Ej: 20.64):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={config.deduccion} onChange={(e) => handleConfigChange('deduccion', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Porcentaje de IRPF por defecto (la Seg. Social del 6.50% se calcula aparte sobre la Base de Cotización).</p>
              </div>

              <div className="p-2 border border-gray-700 bg-[#222] rounded-md">
                <Label className="text-xs font-bold text-red-500 mb-1 block">Retención Especie F99 (€):</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={config.f99} onChange={(e) => handleConfigChange('f99', parseFloat(e.target.value))} className="bg-[#2a2a2a] border-gray-600 flex-1 h-8" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">Concepto F99 IAC Especies Repercutido (1.22 € en agosto / 1.18 € en junio).</p>
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
