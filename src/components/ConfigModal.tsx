import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAppContext } from '../context/AppContext';
import {
  DEFAULT_CONFIG,
  APP_VERSION,
  R2,
  normalizeIrpf,
  getYearConfig,
  calculatePayrollForMonth
} from '../lib/constants';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  initialTab?: string;
}

const MONTHS_ES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, currentDate, initialTab = 'nomina' }) => {
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
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditingYear, setIsEditingYear] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  useEffect(() => {
    if (isOpen) {
      const y = currentDate.getFullYear().toString();
      const m = currentDate.getMonth().toString();
      setActiveTab(initialTab || 'nomina');
      setYear(y);
      setMonth(m);
      loadConfigForYear(y, m);
    }
  }, [isOpen, currentDate, initialTab]);

  const loadConfigForYear = (y: string, mOverride?: string) => {
    const conf = getYearConfig(state.config, y);
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
    showToast(`✓ Configuración guardada (${MONTHS_ES[parseInt(month)]} ${year})`);
  };

  const handleApplyPatron = () => {
    if (!state.start) return;
    const refDate = new Date(state.start);
    const day = refDate.getDay();
    const diff = refDate.getDate() - day + (day === 0 ? -6 : 1);
    const refMonday = new Date(refDate.setDate(diff));
    applyPatron(parseInt(year), refMonday);
    showToast(`✓ Patrón aplicado al año ${year}`);
    setTimeout(() => onClose(), 800);
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
    showToast('✓ Copia de seguridad descargada');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        importData(imported);
        showToast('✓ Copia de seguridad restaurada');
        setTimeout(() => onClose(), 800);
      } catch (err) {
        showToast('⚠️ Error al leer el archivo JSON');
      }
    };
    reader.readAsText(file);
  };

  const yNum = parseInt(year) || 2026;
  const mNum = parseInt(month) || 0;
  const payroll = calculatePayrollForMonth(yNum, mNum, state.data, state.extras, config, monthParams);

  const calculateAnnualEstimates = () => {
    let totalBrutoAnual = 0;
    let totalNetoAnual = 0;
    for (let currentM = 0; currentM < 12; currentM++) {
      const p = currentM === mNum ? monthParams : undefined;
      const res = calculatePayrollForMonth(yNum, currentM, state.data, state.extras, config, p);
      totalBrutoAnual = R2(totalBrutoAnual + res.totalBruto);
      totalNetoAnual = R2(totalNetoAnual + res.liquido);
    }
    return { bruto: totalBrutoAnual, neto: totalNetoAnual };
  };

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

  const nextMonthIdx = (mNum + 1) % 12;
  const payYear = nextMonthIdx === 0 ? yNum + 1 : yNum;

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

        {toastMsg && (
          <div className="bg-[#00e676]/20 border border-[#00e676] text-[#00e676] text-xs font-bold px-3 py-2 rounded text-center fade-in">
            {toastMsg}
          </div>
        )}

        <div className="w-full mt-2 flex flex-col gap-4">
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
                  <Label className="text-xs text-gray-400">MES DE DEVENGO:</Label>
                  <Select value={month} onValueChange={handleMonthChange}>
                    <SelectTrigger className="bg-[#333] border-gray-600 w-full">
                      <SelectValue>
                        {MONTHS_ES[mNum]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-[#333] border-gray-600 text-white">
                      {MONTHS_ES.map((m, i) => (
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
                    placeholder={`Auto: ${fmtN(payroll.cN * 7.75)} h`} 
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
                    placeholder={`Auto: ${fmtN(payroll.cF * 7.75)} h`} 
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

              <div id="printable-payslip" className="bg-white text-black p-3 sm:p-4 rounded font-mono text-[11px] sm:text-[13px] border border-gray-300 mt-4 overflow-x-auto shadow-md">
                <div className="text-center font-bold text-[13px] sm:text-base border-b-2 border-black pb-2 mb-2 uppercase">
                  <div>RECIBO SIMULADO STELLANTIS - {MONTHS_ES[mNum]} {year}</div>
                  <div className="text-[10px] font-normal text-gray-600 mt-0.5">
                    Abono fin de {MONTHS_ES[nextMonthIdx]} {payYear} · {payroll.cN} Noches ({payroll.cF} Fest) · {payroll.cV} Vac
                  </div>
                </div>
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="text-gray-600 border-b border-black text-[10px] sm:text-[11px]">
                      <th className="text-left py-1 pr-2">CONCEPTO</th>
                      <th className="py-1 px-1 text-center min-w-[50px]">UNID.</th>
                      <th className="py-1 px-1 text-center min-w-[70px]">PRECIO</th>
                      <th className="py-1 pl-2 text-right min-w-[90px]">IMPORTE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="text-left font-bold py-1.5 pr-2">G60 Salario Base</td>
                      <td className="py-1.5 px-1 text-center font-mono">{fmtN(payroll.diasBase)}</td>
                      <td className="py-1.5 px-1 text-center">{payroll. ratioDia.toFixed(4).replace('.', ',')}</td>
                      <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impBase)} €</td>
                    </tr>
                    {payroll.impVacaciones > 0 && (
                      <tr>
                        <td className="text-left font-bold py-1.5 pr-2 text-green-800">G70 Vacaciones</td>
                        <td className="py-1.5 px-1 text-center font-mono">{fmtN(payroll.diasVac)}</td>
                        <td className="py-1.5 px-1 text-center">{payroll.ratioDia.toFixed(4).replace('.', ',')}</td>
                        <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap text-green-800">{fmtM(payroll.impVacaciones)} €</td>
                      </tr>
                    )}
                    {payroll.impPagaExtra > 0 && (
                      <tr>
                        <td className="text-left font-bold py-1.5 pr-2">Paga Extra</td>
                        <td className="py-1.5 px-1 text-center font-mono">1,00</td>
                        <td className="py-1.5 px-1 text-center font-mono">{fmtM(config.pagaExtra)}</td>
                        <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impPagaExtra)} €</td>
                      </tr>
                    )}
                    <tr>
                      <td className="text-left font-bold py-1.5 pr-2">K05 Turno Variable Nocturno</td>
                      <td className="py-1.5 px-1 text-center font-mono">{fmtN(payroll.hNoche)}</td>
                      <td className="py-1.5 px-1 text-center font-mono text-gray-600">{fmtM(config.noche)}</td>
                      <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impNoche)} €</td>
                    </tr>
                    <tr>
                      <td className="text-left font-bold py-1.5 pr-2">K75 Garantía Nocturna</td>
                      <td className="py-1.5 px-1 text-center font-mono">{fmtN(payroll.hGarantia)}</td>
                      <td className="py-1.5 px-1 text-center font-mono text-gray-600">{Number(config.garantia).toFixed(4).replace('.', ',')}</td>
                      <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impGarantia)} €</td>
                    </tr>
                    <tr>
                      <td className="text-left font-bold py-1.5 pr-2">KA9 Jornada Ord. Sáb/Dom</td>
                      <td className="py-1.5 px-1 text-center font-mono">{fmtN(payroll.hFestivo)}</td>
                      <td className="py-1.5 px-1 text-center font-mono text-gray-600">{Number(config.festivo).toFixed(4).replace('.', ',')}</td>
                      <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{fmtM(payroll.impFestivo)} €</td>
                    </tr>
                    {payroll.impOtros > 0 && (
                      <tr>
                        <td className="text-left font-bold py-1.5 pr-2">Fijos (K70, KEA, Plus Transp)</td>
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
                        <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{monthParams.cobrarExtras ? `${fmtM(payroll.impExtras)} €` : '(A Bolsa)'}</td>
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
                    <span>F75 IRPF ({fmtM(payroll.irpfPct)}%) + F99 ({fmtM(payroll.f99)} €)</span>
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

              <Button onClick={() => window.print()} className="w-full bg-[#00e676] hover:bg-green-500 text-black font-bold mt-2">🖨️ EXPORTAR PDF / IMPRIMIR RECIBO</Button>

              <div className="bg-black border border-gray-800 rounded p-4 text-center mt-2 shadow-inner">
                <div className="text-xs text-gray-400 font-bold mb-1 tracking-wider uppercase">Proyección Anual Estimada ({year})</div>
                <div className="text-2xl font-black text-[#00e676] mb-1">{fmtM(annualEstimates.bruto)} € Brutos</div>
                <div className="text-sm text-gray-300 font-mono">{fmtM(annualEstimates.neto)} € Netos</div>
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
            <Button onClick={handleApplyPatron} className="w-full bg-[#2979ff] hover:bg-blue-600 font-bold">APLICAR PATRÓN AL AÑO</Button>
            <Button onClick={() => { if(confirm(`¿Borrar todos los turnos de ${year}?`)) { resetYear(parseInt(year)); onClose(); } }} variant="destructive" className="w-full">BORRAR AÑO COMPLETO</Button>
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
              <Button onClick={saveConfig} className="w-full bg-[#2979ff] hover:bg-blue-600 font-bold">GUARDAR DATOS DEL AÑO</Button>
            </div>
            <hr className="border-gray-700" />
            <div className="space-y-2">
              <Button onClick={handleBackup} className="w-full bg-gray-700 hover:bg-gray-600 font-bold">💾 GUARDAR COPIA DE SEGURIDAD (.JSON)</Button>
              <div className="relative">
                <Input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Button className="w-full bg-gray-800 border border-gray-600 hover:bg-gray-700 pointer-events-none font-bold">📂 CARGAR COPIA (.JSON)...</Button>
              </div>
            </div>
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
