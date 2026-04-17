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
  noche: 3.1517,
  garantia: 2.2909,
  festivo: 7.9452,
  deduccion: 0.2709,
  bolsa: 131.38,
  extraBase: 0,
  otros: 16.96,
  adecTotal: 8,
  mesesOtros: 12,
  precioExtra: 20.00,
  mesesParams: {}
};
