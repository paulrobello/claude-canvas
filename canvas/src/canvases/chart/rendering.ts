// Chart Rendering Engine
// Supports braille (2x4 dots), half-block (2x2), and ASCII rendering

import type { RenderMode, DataPoint, Viewport, Size, ChartSeries, ChartType } from './types';
import { BRAILLE_BASE, HALF_BLOCKS, ASCII_CHARS, SERIES_COLORS } from './types';

// ============================================
// Render Mode Detection
// ============================================

export function detectRenderMode(): RenderMode {
  const term = process.env.TERM || '';
  const colorTerm = process.env.COLORTERM || '';
  const lang = process.env.LANG || '';

  // Check for Unicode support
  const hasUnicode = lang.toLowerCase().includes('utf') ||
    term.includes('xterm') ||
    term.includes('screen') ||
    term.includes('tmux') ||
    colorTerm.includes('truecolor') ||
    colorTerm.includes('24bit');

  if (hasUnicode) {
    // Modern terminals support braille
    return 'braille';
  }

  // Fall back to ASCII for basic terminals
  return 'ascii';
}

// ============================================
// Canvas Buffer
// ============================================

export interface CanvasBuffer {
  width: number;    // Width in characters
  height: number;   // Height in characters
  cells: string[][];  // 2D array of characters
  colors: (string | null)[][];  // 2D array of colors per cell
}

export function createBuffer(width: number, height: number): CanvasBuffer {
  const cells: string[][] = [];
  const colors: (string | null)[][] = [];

  for (let y = 0; y < height; y++) {
    const cellRow: string[] = [];
    const colorRow: (string | null)[] = [];
    for (let x = 0; x < width; x++) {
      cellRow.push(' ');
      colorRow.push(null);
    }
    cells.push(cellRow);
    colors.push(colorRow);
  }

  return { width, height, cells, colors };
}

export function setCell(buffer: CanvasBuffer, x: number, y: number, char: string, color?: string): void {
  if (x >= 0 && x < buffer.width && y >= 0 && y < buffer.height) {
    const row = buffer.cells[y];
    const colorRow = buffer.colors[y];
    if (row && colorRow) {
      row[x] = char;
      if (color) {
        colorRow[x] = color;
      }
    }
  }
}

// ============================================
// Braille Rendering (2x4 dots per character)
// ============================================

// Braille dot positions in a cell:
// 0 3
// 1 4
// 2 5
// 6 7

const BRAILLE_DOT_MAP = [
  0x01, 0x02, 0x04, 0x40,  // dots 1,2,3,7 (left column)
  0x08, 0x10, 0x20, 0x80,  // dots 4,5,6,8 (right column)
];

export interface BrailleCanvas {
  width: number;      // Width in characters
  height: number;     // Height in characters
  dotWidth: number;   // Width in dots (width * 2)
  dotHeight: number;  // Height in dots (height * 4)
  dots: boolean[][];  // 2D array of dot states
  colors: (string | null)[][];  // Color per character cell
}

export function createBrailleCanvas(charWidth: number, charHeight: number): BrailleCanvas {
  const dotWidth = charWidth * 2;
  const dotHeight = charHeight * 4;
  const dots: boolean[][] = [];
  const colors: (string | null)[][] = [];

  for (let y = 0; y < dotHeight; y++) {
    dots[y] = new Array(dotWidth).fill(false);
  }

  for (let y = 0; y < charHeight; y++) {
    colors[y] = new Array(charWidth).fill(null);
  }

  return { width: charWidth, height: charHeight, dotWidth, dotHeight, dots, colors };
}

export function setBrailleDot(canvas: BrailleCanvas, x: number, y: number, color?: string): void {
  if (x >= 0 && x < canvas.dotWidth && y >= 0 && y < canvas.dotHeight) {
    const dotRow = canvas.dots[y];
    if (dotRow) {
      dotRow[x] = true;
    }
    if (color) {
      const charX = Math.floor(x / 2);
      const charY = Math.floor(y / 4);
      const colorRow = canvas.colors[charY];
      if (colorRow) {
        colorRow[charX] = color;
      }
    }
  }
}

export function brailleCanvasToBuffer(canvas: BrailleCanvas): CanvasBuffer {
  const buffer = createBuffer(canvas.width, canvas.height);

  for (let charY = 0; charY < canvas.height; charY++) {
    const bufferRow = buffer.cells[charY];
    const bufferColorRow = buffer.colors[charY];
    const canvasColorRow = canvas.colors[charY];
    if (!bufferRow || !bufferColorRow) continue;

    for (let charX = 0; charX < canvas.width; charX++) {
      let pattern = 0;

      // Check each dot in this character cell
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const dotX = charX * 2 + dx;
          const dotY = charY * 4 + dy;
          const dotRow = canvas.dots[dotY];
          if (dotY < canvas.dotHeight && dotX < canvas.dotWidth && dotRow?.[dotX]) {
            const dotIndex = dy + dx * 4;
            pattern |= BRAILLE_DOT_MAP[dotIndex] ?? 0;
          }
        }
      }

      bufferRow[charX] = String.fromCharCode(BRAILLE_BASE + pattern);
      bufferColorRow[charX] = canvasColorRow?.[charX] ?? null;
    }
  }

  return buffer;
}

// ============================================
// Half-Block Rendering (2x2 pixels per character)
// ============================================

export interface HalfBlockCanvas {
  width: number;       // Width in characters
  height: number;      // Height in characters
  pixelWidth: number;  // Width in pixels (width * 2)
  pixelHeight: number; // Height in pixels (height * 2)
  pixels: boolean[][]; // 2D array of pixel states
  colors: (string | null)[][];
}

export function createHalfBlockCanvas(charWidth: number, charHeight: number): HalfBlockCanvas {
  const pixelWidth = charWidth * 2;
  const pixelHeight = charHeight * 2;
  const pixels: boolean[][] = [];
  const colors: (string | null)[][] = [];

  for (let y = 0; y < pixelHeight; y++) {
    pixels[y] = new Array(pixelWidth).fill(false);
  }

  for (let y = 0; y < charHeight; y++) {
    colors[y] = new Array(charWidth).fill(null);
  }

  return { width: charWidth, height: charHeight, pixelWidth, pixelHeight, pixels, colors };
}

export function setHalfBlockPixel(canvas: HalfBlockCanvas, x: number, y: number, color?: string): void {
  if (x >= 0 && x < canvas.pixelWidth && y >= 0 && y < canvas.pixelHeight) {
    const pixelRow = canvas.pixels[y];
    if (pixelRow) {
      pixelRow[x] = true;
    }
    if (color) {
      const charX = Math.floor(x / 2);
      const charY = Math.floor(y / 2);
      const colorRow = canvas.colors[charY];
      if (colorRow) {
        colorRow[charX] = color;
      }
    }
  }
}

export function halfBlockCanvasToBuffer(canvas: HalfBlockCanvas): CanvasBuffer {
  const buffer = createBuffer(canvas.width, canvas.height);

  for (let charY = 0; charY < canvas.height; charY++) {
    const bufferRow = buffer.cells[charY];
    const bufferColorRow = buffer.colors[charY];
    const canvasColorRow = canvas.colors[charY];
    if (!bufferRow || !bufferColorRow) continue;

    for (let charX = 0; charX < canvas.width; charX++) {
      const topY = charY * 2;
      const bottomY = charY * 2 + 1;
      const leftX = charX * 2;
      const rightX = charX * 2 + 1;

      const topRow = canvas.pixels[topY];
      const bottomRow = canvas.pixels[bottomY];

      // Check pixels in this cell (top-left, top-right, bottom-left, bottom-right)
      const topLeft = topY < canvas.pixelHeight && leftX < canvas.pixelWidth && topRow?.[leftX];
      const topRight = topY < canvas.pixelHeight && rightX < canvas.pixelWidth && topRow?.[rightX];
      const bottomLeft = bottomY < canvas.pixelHeight && leftX < canvas.pixelWidth && bottomRow?.[leftX];
      const bottomRight = bottomY < canvas.pixelHeight && rightX < canvas.pixelWidth && bottomRow?.[rightX];

      const topFilled = topLeft || topRight;
      const bottomFilled = bottomLeft || bottomRight;

      let char: string;
      if (topFilled && bottomFilled) {
        char = HALF_BLOCKS.full;
      } else if (topFilled) {
        char = HALF_BLOCKS.upper;
      } else if (bottomFilled) {
        char = HALF_BLOCKS.lower;
      } else {
        char = HALF_BLOCKS.empty;
      }

      bufferRow[charX] = char;
      bufferColorRow[charX] = canvasColorRow?.[charX] ?? null;
    }
  }

  return buffer;
}

// ============================================
// ASCII Rendering
// ============================================

export function setASCIIPoint(buffer: CanvasBuffer, x: number, y: number, color?: string): void {
  setCell(buffer, x, y, ASCII_CHARS.point, color);
}

// ============================================
// Line Drawing (Bresenham's algorithm)
// ============================================

export function drawLine(
  setPixel: (x: number, y: number) => void,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    setPixel(x, y);

    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

// ============================================
// Chart Rendering Functions
// ============================================

export interface RenderOptions {
  mode: RenderMode;
  chartArea: { x: number; y: number; width: number; height: number };
  viewport: Viewport;
  showGrid: boolean;
  gridColor?: string;
}

export function dataToPixel(
  dataX: number,
  dataY: number,
  viewport: Viewport,
  pixelWidth: number,
  pixelHeight: number
): { x: number; y: number } {
  const x = Math.round(((dataX - viewport.minX) / (viewport.maxX - viewport.minX)) * (pixelWidth - 1));
  // Y is inverted (0 at top in terminal)
  const y = Math.round((1 - (dataY - viewport.minY) / (viewport.maxY - viewport.minY)) * (pixelHeight - 1));
  return { x, y };
}

function getPointX(point: DataPoint): number {
  return typeof point.x === 'number' ? point.x : new Date(point.x).getTime();
}

export function renderLineSeries(
  series: ChartSeries,
  options: RenderOptions,
  color: string
): CanvasBuffer {
  const { mode, chartArea, viewport } = options;
  const { width, height } = chartArea;

  if (mode === 'braille') {
    const canvas = createBrailleCanvas(width, height);
    const data = series.data;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      if (!point) continue;
      const x = getPointX(point);
      const { x: px, y: py } = dataToPixel(x, point.y, viewport, canvas.dotWidth, canvas.dotHeight);

      if (i > 0) {
        const prevPoint = data[i - 1];
        if (prevPoint) {
          const prevX = getPointX(prevPoint);
          const { x: prevPx, y: prevPy } = dataToPixel(prevX, prevPoint.y, viewport, canvas.dotWidth, canvas.dotHeight);
          drawLine((lx, ly) => setBrailleDot(canvas, lx, ly, color), prevPx, prevPy, px, py);
        }
      } else {
        setBrailleDot(canvas, px, py, color);
      }
    }

    return brailleCanvasToBuffer(canvas);
  } else if (mode === 'halfblock') {
    const canvas = createHalfBlockCanvas(width, height);
    const data = series.data;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      if (!point) continue;
      const x = getPointX(point);
      const { x: px, y: py } = dataToPixel(x, point.y, viewport, canvas.pixelWidth, canvas.pixelHeight);

      if (i > 0) {
        const prevPoint = data[i - 1];
        if (prevPoint) {
          const prevX = getPointX(prevPoint);
          const { x: prevPx, y: prevPy } = dataToPixel(prevX, prevPoint.y, viewport, canvas.pixelWidth, canvas.pixelHeight);
          drawLine((lx, ly) => setHalfBlockPixel(canvas, lx, ly, color), prevPx, prevPy, px, py);
        }
      } else {
        setHalfBlockPixel(canvas, px, py, color);
      }
    }

    return halfBlockCanvasToBuffer(canvas);
  } else {
    // ASCII mode
    const buffer = createBuffer(width, height);
    const data = series.data;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      if (!point) continue;
      const x = getPointX(point);
      const { x: px, y: py } = dataToPixel(x, point.y, viewport, width, height);

      if (i > 0) {
        const prevPoint = data[i - 1];
        if (prevPoint) {
          const prevX = getPointX(prevPoint);
          const { x: prevPx, y: prevPy } = dataToPixel(prevX, prevPoint.y, viewport, width, height);
          drawLine((lx, ly) => setASCIIPoint(buffer, lx, ly, color), prevPx, prevPy, px, py);
        }
      } else {
        setASCIIPoint(buffer, px, py, color);
      }
    }

    return buffer;
  }
}

export function renderBarSeries(
  series: ChartSeries,
  seriesIndex: number,
  totalSeries: number,
  options: RenderOptions,
  color: string
): CanvasBuffer {
  const { mode, chartArea, viewport } = options;
  const { width, height } = chartArea;
  const buffer = createBuffer(width, height);

  const data = series.data;
  const barCount = data.length;
  if (barCount === 0) return buffer;

  const groupWidth = Math.floor(width / barCount);
  const barWidth = Math.max(1, Math.floor((groupWidth - 1) / totalSeries));

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    if (!point) continue;
    const barHeight = Math.round(((point.y - viewport.minY) / (viewport.maxY - viewport.minY)) * height);
    const barX = i * groupWidth + seriesIndex * barWidth;
    const barTop = height - barHeight;

    // Draw bar
    for (let y = barTop; y < height; y++) {
      for (let x = barX; x < barX + barWidth && x < width; x++) {
        const char = mode === 'ascii' ? '#' : HALF_BLOCKS.full;
        setCell(buffer, x, y, char, color);
      }
    }
  }

  return buffer;
}

export function mergeBuffers(base: CanvasBuffer, overlay: CanvasBuffer): CanvasBuffer {
  const result = createBuffer(base.width, base.height);

  for (let y = 0; y < base.height; y++) {
    const resultRow = result.cells[y];
    const resultColorRow = result.colors[y];
    const overlayRow = overlay.cells[y];
    const overlayColorRow = overlay.colors[y];
    const baseRow = base.cells[y];
    const baseColorRow = base.colors[y];

    if (!resultRow || !resultColorRow) continue;

    for (let x = 0; x < base.width; x++) {
      const overlayChar = overlayRow?.[x];
      if (overlayChar && overlayChar !== ' ') {
        resultRow[x] = overlayChar;
        resultColorRow[x] = overlayColorRow?.[x] ?? baseColorRow?.[x] ?? null;
      } else {
        resultRow[x] = baseRow?.[x] ?? ' ';
        resultColorRow[x] = baseColorRow?.[x] ?? null;
      }
    }
  }

  return result;
}

export function getSeriesColor(index: number, specifiedColor?: string): string {
  if (specifiedColor) return specifiedColor;
  return SERIES_COLORS[index % SERIES_COLORS.length] ?? 'cyan';
}
