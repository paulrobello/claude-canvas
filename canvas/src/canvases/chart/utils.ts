// Chart Utility Functions
// Coordinate transforms, time series parsing, and formatting

import type { Viewport, ScreenPoint, Size, DataPoint, AxisFormat, ScaleType } from './types';

// ============================================
// Coordinate Transformations
// ============================================

/**
 * Convert data coordinates to screen coordinates
 */
export function dataToScreen(
  dataX: number,
  dataY: number,
  viewport: Viewport,
  screenSize: Size
): ScreenPoint {
  const xRange = viewport.maxX - viewport.minX;
  const yRange = viewport.maxY - viewport.minY;

  const x = Math.round(((dataX - viewport.minX) / xRange) * (screenSize.width - 1));
  // Y is inverted (0 at top in terminal)
  const y = Math.round((1 - (dataY - viewport.minY) / yRange) * (screenSize.height - 1));

  return { x, y };
}

/**
 * Convert screen coordinates to data coordinates
 */
export function screenToData(
  screenX: number,
  screenY: number,
  viewport: Viewport,
  screenSize: Size
): { x: number; y: number } {
  const xRange = viewport.maxX - viewport.minX;
  const yRange = viewport.maxY - viewport.minY;

  const x = viewport.minX + (screenX / (screenSize.width - 1)) * xRange;
  // Y is inverted
  const y = viewport.minY + (1 - screenY / (screenSize.height - 1)) * yRange;

  return { x, y };
}

// ============================================
// Scale Transformations
// ============================================

/**
 * Apply scale transformation to a value
 */
export function applyScale(value: number, scale: ScaleType): number {
  if (scale === 'log') {
    return value > 0 ? Math.log10(value) : 0;
  }
  return value;
}

/**
 * Reverse scale transformation
 */
export function reverseScale(value: number, scale: ScaleType): number {
  if (scale === 'log') {
    return Math.pow(10, value);
  }
  return value;
}

// ============================================
// Time Series Parsing
// ============================================

/**
 * Parse a time value (number or ISO string) to timestamp
 */
export function parseTimeValue(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date value: ${value}`);
    return 0;
  }
  return date.getTime();
}

/**
 * Detect if data appears to be time series
 */
export function isTimeSeries(data: DataPoint[]): boolean {
  if (data.length === 0) return false;

  // Check first value
  const firstPoint = data[0];
  if (!firstPoint) return false;

  const firstX = firstPoint.x;

  if (typeof firstX === 'string') {
    // Try to parse as date
    const date = new Date(firstX);
    return !isNaN(date.getTime());
  }

  // Check if numbers look like timestamps (> year 2000 in ms)
  if (typeof firstX === 'number' && firstX > 946684800000) {
    return true;
  }

  return false;
}

// ============================================
// Tick Formatting
// ============================================

/**
 * Format a tick label based on format type
 */
export function formatTickLabel(value: number, format: AxisFormat): string {
  switch (format) {
    case 'date':
      return formatDate(value);
    case 'time':
      return formatTime(value);
    case 'datetime':
      return formatDateTime(value);
    case 'number':
    default:
      return formatNumber(value);
  }
}

/**
 * Format a number with appropriate precision
 */
export function formatNumber(value: number): string {
  const absValue = Math.abs(value);

  if (absValue === 0) return '0';

  if (absValue >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (absValue >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  if (absValue >= 1) {
    return value.toFixed(1);
  }
  if (absValue >= 0.01) {
    return value.toFixed(2);
  }
  return value.toExponential(1);
}

/**
 * Format a timestamp as date (YYYY-MM-DD or shorter)
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}/${day}`;
}

/**
 * Format a timestamp as time (HH:MM)
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format a timestamp as datetime
 */
export function formatDateTime(timestamp: number): string {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

// ============================================
// Tick Generation
// ============================================

/**
 * Generate nice tick values for an axis
 */
export function generateTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  const roughStep = range / (count - 1);

  // Find a "nice" step size (1, 2, 5, 10, 20, 50, etc.)
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;

  let niceStep: number;
  if (residual <= 1.5) {
    niceStep = magnitude;
  } else if (residual <= 3) {
    niceStep = 2 * magnitude;
  } else if (residual <= 7) {
    niceStep = 5 * magnitude;
  } else {
    niceStep = 10 * magnitude;
  }

  // Generate ticks
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;

  const ticks: number[] = [];
  for (let tick = niceMin; tick <= niceMax; tick += niceStep) {
    if (tick >= min && tick <= max) {
      ticks.push(tick);
    }
  }

  return ticks;
}

/**
 * Generate time-based ticks
 */
export function generateTimeTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  const msPerDay = 24 * 60 * 60 * 1000;
  const msPerHour = 60 * 60 * 1000;
  const msPerMinute = 60 * 1000;

  // Choose appropriate interval
  let interval: number;
  if (range > 365 * msPerDay) {
    interval = 30 * msPerDay; // Monthly
  } else if (range > 30 * msPerDay) {
    interval = 7 * msPerDay; // Weekly
  } else if (range > 7 * msPerDay) {
    interval = msPerDay; // Daily
  } else if (range > msPerDay) {
    interval = 6 * msPerHour; // 6 hours
  } else if (range > 6 * msPerHour) {
    interval = msPerHour; // Hourly
  } else if (range > msPerHour) {
    interval = 15 * msPerMinute; // 15 minutes
  } else {
    interval = 5 * msPerMinute; // 5 minutes
  }

  // Generate ticks
  const start = Math.ceil(min / interval) * interval;
  const ticks: number[] = [];

  for (let tick = start; tick <= max && ticks.length < count; tick += interval) {
    ticks.push(tick);
  }

  return ticks;
}

// ============================================
// Grid Lines
// ============================================

/**
 * Generate grid line characters
 */
export function getGridChar(hasHorizontal: boolean, hasVertical: boolean): string {
  if (hasHorizontal && hasVertical) return '┼';
  if (hasHorizontal) return '─';
  if (hasVertical) return '│';
  return ' ';
}

// ============================================
// Data Helpers
// ============================================

/**
 * Find the closest data point to a screen position
 */
export function findClosestPoint(
  screenX: number,
  screenY: number,
  data: DataPoint[],
  viewport: Viewport,
  screenSize: Size
): { point: DataPoint; index: number; distance: number } | null {
  if (data.length === 0) return null;

  let closest: { point: DataPoint; index: number; distance: number } | null = null;

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    if (!point) continue;
    const x = typeof point.x === 'number' ? point.x : parseTimeValue(point.x);
    const { x: px, y: py } = dataToScreen(x, point.y, viewport, screenSize);

    const distance = Math.sqrt(Math.pow(px - screenX, 2) + Math.pow(py - screenY, 2));

    if (!closest || distance < closest.distance) {
      closest = { point, index: i, distance };
    }
  }

  return closest;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
