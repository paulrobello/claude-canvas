// Chart Canvas Type Definitions

export type ChartType = 'line' | 'bar';
export type RenderMode = 'braille' | 'halfblock' | 'ascii' | 'auto';
export type ScaleType = 'linear' | 'log';
export type AxisFormat = 'number' | 'date' | 'time' | 'datetime' | 'auto';

export interface DataPoint {
  x: number | string;  // number or ISO date string
  y: number;
}

export interface ChartSeries {
  id: string;
  name: string;
  data: DataPoint[];
  color?: string;
  type?: ChartType;  // Override chart type per series
}

export interface AxisConfig {
  label?: string;
  showTicks?: boolean;
  tickCount?: number;
  format?: AxisFormat;
  min?: number;
  max?: number;
}

export interface ChartConfig {
  title?: string;
  series: ChartSeries[];
  chartType: ChartType;

  // Axes
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  showGrid?: boolean;
  showLegend?: boolean;

  // Scale
  scale?: ScaleType;
  autoBounds?: boolean;
  bounds?: {
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
  };

  // Rendering
  renderMode?: RenderMode;

  // Interaction
  crosshair?: boolean;

  // Margins (in characters)
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

export interface Viewport {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  zoomLevel: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ScreenPoint {
  x: number;  // Terminal column (0-based)
  y: number;  // Terminal row (0-based)
}

export interface Size {
  width: number;
  height: number;
}

export interface ChartCanvasProps {
  config: ChartConfig;
  socketPath?: string;
  scenario?: string;
  onResult?: (result: ChartResult) => void;
}

export interface ChartResult {
  action: 'select' | 'zoom' | 'pan' | 'close';
  viewport?: Viewport;
  selectedPoint?: DataPoint;
  selectedSeries?: string;
}

// Color palette for series
export const SERIES_COLORS = [
  'cyan',
  'magenta',
  'yellow',
  'green',
  'blue',
  'red',
  'white',
  'gray',
] as const;

export type SeriesColor = typeof SERIES_COLORS[number];

// Default configuration values
export const DEFAULT_CONFIG: Partial<ChartConfig> = {
  chartType: 'line',
  renderMode: 'auto',
  scale: 'linear',
  autoBounds: true,
  showGrid: true,
  showLegend: true,
  crosshair: false,
  margins: {
    top: 2,
    right: 2,
    bottom: 3,
    left: 8,
  },
};

// Braille character mapping
// Braille patterns use dots numbered:
// 1 4
// 2 5
// 3 6
// 7 8
// Unicode braille starts at U+2800
export const BRAILLE_BASE = 0x2800;

// Half-block characters
export const HALF_BLOCKS = {
  empty: ' ',
  upper: '▀',
  lower: '▄',
  full: '█',
  light: '░',
  medium: '▒',
  dark: '▓',
} as const;

// ASCII chart characters
export const ASCII_CHARS = {
  point: '*',
  hLine: '-',
  vLine: '|',
  corner: '+',
  cross: '+',
  empty: ' ',
} as const;
