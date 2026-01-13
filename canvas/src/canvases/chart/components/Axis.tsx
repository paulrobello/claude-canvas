// Axis Component - Renders X and Y axes with labels and ticks

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { Viewport, AxisConfig, AxisFormat } from '../types';
import { generateTicks, generateTimeTicks, formatTickLabel, isTimeSeries } from '../utils';

export interface YAxisProps {
  viewport: Viewport;
  height: number;
  width?: number;
  config?: AxisConfig;
  isTimeSeries?: boolean;
}

export function YAxis({
  viewport,
  height,
  width = 8,
  config,
}: YAxisProps): React.ReactElement {
  // Account for label row in height calculation
  const hasLabel = !!config?.label;
  const dataHeight = hasLabel ? height - 1 : height;

  const ticks = useMemo(() => {
    const count = Math.min(dataHeight, config?.tickCount || 6);
    return generateTicks(viewport.minY, viewport.maxY, count);
  }, [viewport, dataHeight, config?.tickCount]);

  const format = config?.format || 'number';

  const lines = useMemo(() => {
    const result: React.ReactElement[] = [];

    for (let y = 0; y < dataHeight; y++) {
      // Map screen Y to data Y (inverted)
      const dataY = viewport.maxY - (y / Math.max(1, dataHeight - 1)) * (viewport.maxY - viewport.minY);

      // Find if there's a tick near this position
      const nearestTick = ticks.find((tick) => {
        const tickY = Math.round(((viewport.maxY - tick) / (viewport.maxY - viewport.minY)) * Math.max(1, dataHeight - 1));
        return Math.abs(tickY - y) < 1;
      });

      let label = '';
      if (nearestTick !== undefined) {
        label = formatTickLabel(nearestTick, format);
      }

      result.push(
        <Box key={y} width={width} justifyContent="flex-end">
          <Text color="gray">{label.padStart(width - 1, ' ')} │</Text>
        </Box>
      );
    }

    return result;
  }, [viewport, dataHeight, ticks, format, width]);

  return (
    <Box flexDirection="column" height={height}>
      {hasLabel && (
        <Box justifyContent="flex-end" width={width}>
          <Text color="cyan" bold>{config!.label!.slice(0, width - 2)}</Text>
        </Box>
      )}
      {lines}
    </Box>
  );
}

export interface XAxisProps {
  viewport: Viewport;
  width: number;
  height?: number;
  config?: AxisConfig;
  offsetLeft?: number;
  isTimeSeries?: boolean;
}

export function XAxis({
  viewport,
  width,
  height = 2,
  config,
  offsetLeft = 0,
  isTimeSeries: isTime = false,
}: XAxisProps): React.ReactElement {
  const ticks = useMemo(() => {
    const count = Math.min(Math.floor(width / 10), config?.tickCount || 6);
    if (isTime) {
      return generateTimeTicks(viewport.minX, viewport.maxX, count);
    }
    return generateTicks(viewport.minX, viewport.maxX, count);
  }, [viewport, width, config?.tickCount, isTime]);

  const format = config?.format || (isTime ? 'datetime' : 'number');

  const axisLine = useMemo(() => {
    let line = '─'.repeat(width);

    // Add tick marks
    ticks.forEach((tick) => {
      const x = Math.round(((tick - viewport.minX) / (viewport.maxX - viewport.minX)) * (width - 1));
      if (x >= 0 && x < width) {
        line = line.slice(0, x) + '┴' + line.slice(x + 1);
      }
    });

    return line;
  }, [ticks, viewport, width]);

  const tickLabels = useMemo(() => {
    const labels: { x: number; text: string }[] = [];

    ticks.forEach((tick) => {
      const x = Math.round(((tick - viewport.minX) / (viewport.maxX - viewport.minX)) * (width - 1));
      const text = formatTickLabel(tick, format);
      labels.push({ x, text });
    });

    // Build label line
    let line = ' '.repeat(width);
    labels.forEach(({ x, text }) => {
      const start = Math.max(0, x - Math.floor(text.length / 2));
      const end = Math.min(width, start + text.length);
      const actualStart = Math.min(start, width - text.length);

      if (actualStart >= 0) {
        line = line.slice(0, actualStart) + text + line.slice(actualStart + text.length);
      }
    });

    return line;
  }, [ticks, viewport, width, format]);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray">{' '.repeat(offsetLeft)}{axisLine}</Text>
      </Box>
      <Box>
        <Text color="gray">{' '.repeat(offsetLeft)}{tickLabels}</Text>
      </Box>
      {config?.label && (
        <Box justifyContent="center" width={width + offsetLeft}>
          <Text color="cyan" bold>{config.label}</Text>
        </Box>
      )}
    </Box>
  );
}
