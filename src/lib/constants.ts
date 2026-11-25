export const APP_VERSION = 'V54 PRO';

export const STORAGE_KEYS = {
  DATA: 'nomina_stellantis_universal_data_v3',
  CONFIG: 'nomina_stellantis_universal_config_v4',
  EXTRAS: 'nomina_stellantis_universal_extras_diarias_v1',
  PATRON: 'nomina_stellantis_universal_patron_v3',
  START: 'nomina_stellantis_universal_start_v3',
};

export const SHIFT_TYPES = {
  LIBRE: 0,
  NOCHE: 1,
  FESTIVO: 2,
  VACACIONES: 3,
  CONVENIO: 4,
  ADECUACION: 5,
  DIA: 6,
};

export const COLORS = {
  NOCHE: '#2979ff',
  FESTIVO: '#ff1744',
  VACACIONES: '#00e676',
  CONVENIO: '#ffea00',
  ADECUACION: '#00b0ff',
  DIA: '#ffffff',
  LIBRE: '#1a1a1a',
  EXTRA: '#ff9100',
  BOLSA: '#ffd700',
};

export const DEFAULT_CONFIG = {
  salario: 2516.37,
  pagaExtra: 2516.37,
  pagaExtraVeranoMes: 5,   // Junio (0-indexed)
  pagaExtraNavidadMes: 9,  // Octubre (abono fin noviembre)
  noche: 3.151789,
  garantia: 2.2909,
  festivo: 7.9452,
  deduccion: 20.64,
  prorrataSS: 443.18,
  f99: 1.22,
  bolsa: 131.38,
  sumarExtrasABolsa: true,
  extraBase: 0,
  otros: 38.37,
  adecTotal: 8,
  mesesOtros: 12,
  precioExtra: 20.00,
  mesesParams: {} as Record<string, any>,
};

export const R2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const safeNum = (val: any, fallback = 0): number => {
  if (val === '' || val === null || val === undefined) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

export const normalizeIrpf = (val: any, fallback: any) => {
  const raw = val !== undefined && val !== '' && val !== null ? safeNum(val, 20.64) : safeNum(fallback, 20.64);
  if (raw > 0 && raw < 1) {
    return R2(Math.max(0, (raw - 0.065) * 100));
  }
  return raw;
};

export const getYearConfig = (configMap: Record<string, any>, year: number | string) => {
  const yStr = year.toString();
  const keys = Object.keys(configMap || {}).sort().reverse();
  const rawConf = configMap?.[yStr] || (keys.length > 0 ? configMap[keys[0]] : DEFAULT_CONFIG) || DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...rawConf,
    noche: Number(rawConf.noche) === 3.1517 ? 3.151789 : safeNum(rawConf.noche, 3.151789),
    prorrataSS: rawConf.prorrataSS !== undefined ? safeNum(rawConf.prorrataSS, 443.18) : 443.18,
    f99: rawConf.f99 !== undefined ? safeNum(rawConf.f99, 1.22) : 1.22,
    pagaExtraVeranoMes: rawConf.pagaExtraVeranoMes !== undefined ? safeNum(rawConf.pagaExtraVeranoMes, 5) : 5,
    pagaExtraNavidadMes: rawConf.pagaExtraNavidadMes !== undefined ? safeNum(rawConf.pagaExtraNavidadMes, 9) : 9,
    sumarExtrasABolsa: rawConf.sumarExtrasABolsa !== undefined ? Boolean(rawConf.sumarExtrasABolsa) : true,
  };
};

export const calculateUnpaidExtrasForYear = (
  year: number,
  extras: Record<string, number>,
  rawConfig: any
): number => {
  const yPrefix = `${year}-`;
  let unpaid = 0;
  Object.entries(extras || {}).forEach(([dateStr, val]) => {
    if (!dateStr.startsWith(yPrefix)) return;
    const parts = dateStr.split('-');
    if (parts.length < 2) return;
    const mIdx = parseInt(parts[1], 10) - 1;
    if (Number.isNaN(mIdx)) return;
    const monthParam = rawConfig?.mesesParams?.[mIdx.toString()];
    const cobrarExtras = Boolean(monthParam?.cobrarExtras);
    if (!cobrarExtras) {
      unpaid += safeNum(val, 0);
    }
  });
  return R2(unpaid);
};

export const calculatePayrollForMonth = (
  year: number,
  month: number,
  data: Record<string, number>,
  extras: Record<string, number>,
  rawConfig: any,
  customMonthParams?: any
) => {
  let cN = 0, cF = 0, cV = 0, cD = 0, cT = 0, hExtraMes = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const v = data[k] || 0;
    if (v === SHIFT_TYPES.NOCHE) { cN++; cT++; }
    else if (v === SHIFT_TYPES.FESTIVO) { cN++; cF++; cT++; }
    else if (v === SHIFT_TYPES.DIA) { cD++; cT++; }
    else if (v === SHIFT_TYPES.VACACIONES) { cV++; }
    if (extras[k]) hExtraMes += safeNum(extras[k], 0);
  }
  hExtraMes = R2(hExtraMes);

  const p = customMonthParams || rawConfig?.mesesParams?.[month.toString()] || {};
  const irpfPct = normalizeIrpf(p.irpf, rawConfig?.deduccion);

  const hNoche = p.hNocheManual !== undefined && p.hNocheManual !== '' ? safeNum(p.hNocheManual, 0) : R2(cN * 7.75);
  const hGarantia = R2((hNoche / 7.75) * 3.75);
  const hFestivo = p.hFestivoManual !== undefined && p.hFestivoManual !== '' ? safeNum(p.hFestivoManual, 0) : R2(cF * 7.75);

  const salarioTotal = R2(safeNum(rawConfig?.salario, 2516.37));
  const ratioDia = salarioTotal / 30;
  const diasVac = Math.min(30, cV);
  const diasBase = Math.max(0, 30 - diasVac);
  const impVacaciones = diasVac > 0 ? R2(diasVac * ratioDia) : 0;
  const impBase = R2(salarioTotal - impVacaciones);

  const impNoche = R2(hNoche * safeNum(rawConfig?.noche, 3.151789));
  const impGarantia = R2(hGarantia * safeNum(rawConfig?.garantia, 2.2909));
  const impFestivo = R2(hFestivo * safeNum(rawConfig?.festivo, 7.9452));

  const mesesOtros = rawConfig?.mesesOtros !== undefined ? safeNum(rawConfig.mesesOtros, 12) : 12;
  const defaultOtros = (mesesOtros === 11 && month === 7) ? 0 : safeNum(rawConfig?.otros, 0);
  const impOtros = p.otrosMes !== undefined && p.otrosMes !== '' ? R2(safeNum(p.otrosMes, 0)) : R2(defaultOtros);

  const mesExtraVerano = rawConfig?.pagaExtraVeranoMes !== undefined ? safeNum(rawConfig.pagaExtraVeranoMes, 5) : 5;
  const mesExtraNavidad = rawConfig?.pagaExtraNavidadMes !== undefined ? safeNum(rawConfig.pagaExtraNavidadMes, 9) : 9;
  const impPagaExtra = (month === mesExtraVerano || month === mesExtraNavidad) ? R2(safeNum(rawConfig?.pagaExtra, 0)) : 0;

  let impExtras = 0;
  if (hExtraMes !== 0 && p.cobrarExtras) {
    impExtras = R2(hExtraMes * safeNum(rawConfig?.precioExtra, 20));
  }

  const valPrima = R2(safeNum(p.prima, 0));
  const ajusteNeto = R2(safeNum(p.ajusteNeto, 0));

  const totalBruto = R2(impBase + impVacaciones + impNoche + impGarantia + impFestivo + impPagaExtra + impOtros + impExtras + valPrima);

  const prorrataSS = safeNum(rawConfig?.prorrataSS, 443.18);
  const f99 = safeNum(rawConfig?.f99, 1.22);
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
    cT, cN, cF, cV, cD, daysInMonth,
    diasBase, diasVac, ratioDia,
    hNoche, hGarantia, hFestivo, hExtraMes,
    impBase, impVacaciones, impNoche, impGarantia, impFestivo, impOtros, impPagaExtra, impExtras, valPrima,
    baseSS, cuotaIRPF, cuotaSS, f99, irpfPct, ajusteNeto,
    totalBruto, totalDeduccion, liquido
  };
};
