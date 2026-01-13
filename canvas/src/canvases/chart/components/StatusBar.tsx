// StatusBar Component - Shows zoom level, cursor position, and keyboard hints

import React from 'react';
import { Box, Text } from 'ink';
import type { Viewport, AxisFormat } from '../types';
import { formatTickLabel } from '../utils';

export interface StatusBarProps {
  viewport: Viewport;
  cursorData?: { x: number; y: number };
  isTimeSeries?: boolean;
  showHelp?: boolean;
}

export function StatusBar({
  viewport,
  cursorData,
  isTimeSeries = false,
  showHelp = true,
}: StatusBarProps): React.ReactElement {
  const zoomPercent = Math.round(viewport.zoomLevel * 100);
  const xFormat: AxisFormat = isTimeSeries ? 'datetime' : 'number';

  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Box>
        <Text color="gray">Zoom: </Text>
        <Text color="cyan">{zoomPercent}%</Text>
        {cursorData && (
          <>
            <Text color="gray">  X: </Text>
            <Text color="yellow">{formatTickLabel(cursorData.x, xFormat)}</Text>
            <Text color="gray">  Y: </Text>
            <Text color="yellow">{formatTickLabel(cursorData.y, 'number')}</Text>
          </>
        )}
      </Box>
      {showHelp && (
        <Box>
          <Text color="gray">
            ←→↑↓ pan  +/- zoom  r reset  f fit  c crosshair  q quit
          </Text>
        </Box>
      )}
    </Box>
  );
}

export interface CrosshairTooltipProps {
  x: number;
  y: number;
  dataX: number;
  dataY: number;
  seriesName?: string;
  isTimeSeries?: boolean;
  screenWidth: number;
}

export function CrosshairTooltip({
  x,
  y,
  dataX,
  dataY,
  seriesName,
  isTimeSeries = false,
  screenWidth,
}: CrosshairTooltipProps): React.ReactElement | null {
  const xFormat: AxisFormat = isTimeSeries ? 'datetime' : 'number';
  const xLabel = formatTickLabel(dataX, xFormat);
  const yLabel = formatTickLabel(dataY, 'number');

  const tooltipText = seriesName
    ? `${seriesName}: (${xLabel}, ${yLabel})`
    : `(${xLabel}, ${yLabel})`;

  // Position tooltip to avoid going off screen
  const tooltipX = Math.min(x, screenWidth - tooltipText.length - 2);

  return (
    <Box position="absolute" marginLeft={tooltipX} marginTop={Math.max(0, y - 1)}>
      <Text backgroundColor="white" color="black">
        {` ${tooltipText} `}
      </Text>
    </Box>
  );
}
