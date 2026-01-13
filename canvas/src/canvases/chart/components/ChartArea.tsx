// ChartArea Component - Main rendering area for chart data

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { ChartSeries, Viewport, RenderMode, ChartType, Size } from '../types';
import {
  detectRenderMode,
  renderLineSeries,
  renderBarSeries,
  mergeBuffers,
  createBuffer,
  getSeriesColor,
  type CanvasBuffer,
  type RenderOptions,
} from '../rendering';

export interface ChartAreaProps {
  series: ChartSeries[];
  chartType: ChartType;
  viewport: Viewport;
  width: number;
  height: number;
  renderMode: RenderMode;
  showGrid?: boolean;
  crosshairX?: number;
  crosshairY?: number;
}

export function ChartArea({
  series,
  chartType,
  viewport,
  width,
  height,
  renderMode,
  showGrid = false,
  crosshairX,
  crosshairY,
}: ChartAreaProps): React.ReactElement {
  // Determine actual render mode
  const actualRenderMode = useMemo(() => {
    return renderMode === 'auto' ? detectRenderMode() : renderMode;
  }, [renderMode]);

  // Render all series
  const buffer = useMemo(() => {
    const chartArea = { x: 0, y: 0, width, height };
    const options: RenderOptions = {
      mode: actualRenderMode,
      chartArea,
      viewport,
      showGrid,
    };

    // Start with empty buffer
    let result = createBuffer(width, height);

    // Render grid if enabled
    if (showGrid) {
      result = renderGrid(result, viewport, width, height);
    }

    // Render each series
    series.forEach((s, index) => {
      const type = s.type || chartType;
      const color = getSeriesColor(index, s.color);

      let seriesBuffer: CanvasBuffer;
      if (type === 'bar') {
        seriesBuffer = renderBarSeries(s, index, series.length, options, color);
      } else {
        seriesBuffer = renderLineSeries(s, options, color);
      }

      result = mergeBuffers(result, seriesBuffer);
    });

    // Render crosshair if enabled
    if (crosshairX !== undefined && crosshairY !== undefined) {
      result = renderCrosshair(result, crosshairX, crosshairY);
    }

    return result;
  }, [series, chartType, viewport, width, height, actualRenderMode, showGrid, crosshairX, crosshairY]);

  // Convert buffer to JSX
  const lines = useMemo(() => {
    const result: React.ReactElement[] = [];

    for (let y = 0; y < buffer.height; y++) {
      const spans: React.ReactElement[] = [];
      let currentColor: string | null = null;
      let currentText = '';

      for (let x = 0; x < buffer.width; x++) {
        const row = buffer.cells[y];
        const colorRow = buffer.colors[y];
        const char = row?.[x] ?? ' ';
        const color = colorRow?.[x] ?? null;

        if (color !== currentColor) {
          if (currentText) {
            spans.push(
              <Text key={`${y}-${spans.length}`} color={currentColor || undefined}>
                {currentText}
              </Text>
            );
          }
          currentColor = color;
          currentText = char;
        } else {
          currentText += char;
        }
      }

      // Add remaining text
      if (currentText) {
        spans.push(
          <Text key={`${y}-${spans.length}`} color={currentColor || undefined}>
            {currentText}
          </Text>
        );
      }

      result.push(
        <Box key={y} flexDirection="row">
          {spans}
        </Box>
      );
    }

    return result;
  }, [buffer]);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {lines}
    </Box>
  );
}

function renderGrid(buffer: CanvasBuffer, viewport: Viewport, width: number, height: number): CanvasBuffer {
  const gridColor = 'gray';

  // Render horizontal grid lines (every ~5 rows)
  const hSpacing = Math.max(1, Math.floor(height / 5));
  for (let y = hSpacing; y < height; y += hSpacing) {
    const row = buffer.cells[y];
    const colorRow = buffer.colors[y];
    if (!row || !colorRow) continue;
    for (let x = 0; x < width; x++) {
      if (row[x] === ' ') {
        row[x] = '·';
        colorRow[x] = gridColor;
      }
    }
  }

  // Render vertical grid lines (every ~10 columns)
  const vSpacing = Math.max(1, Math.floor(width / 10));
  for (let x = vSpacing; x < width; x += vSpacing) {
    for (let y = 0; y < height; y++) {
      const row = buffer.cells[y];
      const colorRow = buffer.colors[y];
      if (!row || !colorRow) continue;
      if (row[x] === ' ') {
        row[x] = '·';
        colorRow[x] = gridColor;
      }
    }
  }

  return buffer;
}

function renderCrosshair(buffer: CanvasBuffer, x: number, y: number): CanvasBuffer {
  const crosshairColor = 'white';

  // Horizontal line
  if (y >= 0 && y < buffer.height) {
    const row = buffer.cells[y];
    const colorRow = buffer.colors[y];
    if (row && colorRow) {
      for (let cx = 0; cx < buffer.width; cx++) {
        if (cx !== x && row[cx] === ' ') {
          row[cx] = '─';
          colorRow[cx] = crosshairColor;
        }
      }
    }
  }

  // Vertical line
  if (x >= 0 && x < buffer.width) {
    for (let cy = 0; cy < buffer.height; cy++) {
      const row = buffer.cells[cy];
      const colorRow = buffer.colors[cy];
      if (!row || !colorRow) continue;
      if (cy !== y && row[x] === ' ') {
        row[x] = '│';
        colorRow[x] = crosshairColor;
      }
    }
  }

  // Center point
  if (x >= 0 && x < buffer.width && y >= 0 && y < buffer.height) {
    const row = buffer.cells[y];
    const colorRow = buffer.colors[y];
    if (row && colorRow) {
      row[x] = '┼';
      colorRow[x] = crosshairColor;
    }
  }

  return buffer;
}
