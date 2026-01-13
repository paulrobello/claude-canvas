// Viewport Hook for Pan/Zoom State Management

import { useState, useCallback, useMemo } from 'react';
import type { Viewport, Bounds, ChartConfig, ChartSeries, DataPoint } from '../types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 100;
const DEFAULT_PADDING = 0.05; // 5% padding around data

export interface UseViewportOptions {
  series: ChartSeries[];
  config: ChartConfig;
}

export interface UseViewportReturn {
  viewport: Viewport;
  pan: (dx: number, dy: number) => void;
  zoom: (factor: number, centerX?: number, centerY?: number) => void;
  reset: () => void;
  fitToData: () => void;
  setViewport: (viewport: Viewport) => void;
  dataBounds: Bounds;
}

/**
 * Calculate bounds from all data series
 */
export function calculateDataBounds(series: ChartSeries[]): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const s of series) {
    for (const point of s.data) {
      const x = typeof point.x === 'number' ? point.x : new Date(point.x).getTime();
      const y = point.y;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Handle edge cases
  if (!isFinite(minX)) minX = 0;
  if (!isFinite(maxX)) maxX = 100;
  if (!isFinite(minY)) minY = 0;
  if (!isFinite(maxY)) maxY = 100;

  // Ensure non-zero range
  if (maxX === minX) {
    minX -= 1;
    maxX += 1;
  }
  if (maxY === minY) {
    minY -= 1;
    maxY += 1;
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Add padding to bounds
 */
function addPadding(bounds: Bounds, padding: number = DEFAULT_PADDING): Bounds {
  const xRange = bounds.maxX - bounds.minX;
  const yRange = bounds.maxY - bounds.minY;

  return {
    minX: bounds.minX - xRange * padding,
    maxX: bounds.maxX + xRange * padding,
    minY: bounds.minY - yRange * padding,
    maxY: bounds.maxY + yRange * padding,
  };
}

/**
 * Apply config bounds if specified
 */
function applyConfigBounds(bounds: Bounds, config: ChartConfig): Bounds {
  const result = { ...bounds };

  if (config.bounds) {
    if (config.bounds.minX !== undefined) result.minX = config.bounds.minX;
    if (config.bounds.maxX !== undefined) result.maxX = config.bounds.maxX;
    if (config.bounds.minY !== undefined) result.minY = config.bounds.minY;
    if (config.bounds.maxY !== undefined) result.maxY = config.bounds.maxY;
  }

  if (config.yAxis?.min !== undefined) result.minY = config.yAxis.min;
  if (config.yAxis?.max !== undefined) result.maxY = config.yAxis.max;
  if (config.xAxis?.min !== undefined) result.minX = config.xAxis.min;
  if (config.xAxis?.max !== undefined) result.maxX = config.xAxis.max;

  return result;
}

export function useViewport({ series, config }: UseViewportOptions): UseViewportReturn {
  // Calculate data bounds
  const dataBounds = useMemo(() => calculateDataBounds(series), [series]);

  // Calculate initial viewport with padding
  const initialViewport = useMemo(() => {
    let bounds = config.autoBounds !== false ? addPadding(dataBounds) : dataBounds;
    bounds = applyConfigBounds(bounds, config);

    return {
      ...bounds,
      zoomLevel: 1,
    };
  }, [dataBounds, config]);

  const [viewport, setViewport] = useState<Viewport>(initialViewport);

  /**
   * Pan the viewport by a delta in data units
   */
  const pan = useCallback((dx: number, dy: number) => {
    setViewport((prev) => {
      const xRange = prev.maxX - prev.minX;
      const yRange = prev.maxY - prev.minY;

      // Scale delta by current range (dx/dy are normalized 0-1)
      const scaledDx = dx * xRange;
      const scaledDy = dy * yRange;

      return {
        ...prev,
        minX: prev.minX + scaledDx,
        maxX: prev.maxX + scaledDx,
        minY: prev.minY + scaledDy,
        maxY: prev.maxY + scaledDy,
      };
    });
  }, []);

  /**
   * Zoom the viewport by a factor, optionally centered on a point
   */
  const zoom = useCallback((factor: number, centerX?: number, centerY?: number) => {
    setViewport((prev) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoomLevel * factor));
      const actualFactor = newZoom / prev.zoomLevel;

      const xRange = prev.maxX - prev.minX;
      const yRange = prev.maxY - prev.minY;

      // Default center to viewport center
      const cx = centerX ?? (prev.minX + xRange / 2);
      const cy = centerY ?? (prev.minY + yRange / 2);

      // Calculate new range
      const newXRange = xRange / actualFactor;
      const newYRange = yRange / actualFactor;

      // Calculate new bounds centered on the zoom point
      const xRatio = (cx - prev.minX) / xRange;
      const yRatio = (cy - prev.minY) / yRange;

      return {
        minX: cx - newXRange * xRatio,
        maxX: cx + newXRange * (1 - xRatio),
        minY: cy - newYRange * yRatio,
        maxY: cy + newYRange * (1 - yRatio),
        zoomLevel: newZoom,
      };
    });
  }, []);

  /**
   * Reset viewport to initial state
   */
  const reset = useCallback(() => {
    setViewport(initialViewport);
  }, [initialViewport]);

  /**
   * Fit viewport to show all data
   */
  const fitToData = useCallback(() => {
    const bounds = addPadding(dataBounds);
    setViewport({
      ...bounds,
      zoomLevel: 1,
    });
  }, [dataBounds]);

  return {
    viewport,
    pan,
    zoom,
    reset,
    fitToData,
    setViewport,
    dataBounds,
  };
}
