// Chart Canvas - Interactive chart with pan/zoom and multiple render modes
// Supports line and bar charts with braille, halfblock, or ASCII rendering

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type {
  ChartConfig,
  ChartCanvasProps,
  ChartResult,
  ChartSeries,
  Viewport,
  RenderMode,
  DataPoint,
} from './types';
import { useViewport } from './hooks/use-viewport';
import { ChartArea, YAxis, XAxis, Legend, StatusBar, CrosshairTooltip } from './components';
import { useTerminalSize, useMouse } from '../../shared/hooks';
import { screenToData, isTimeSeries } from './utils';

// Pan step as fraction of viewport range
const PAN_STEP = 0.1;
const ZOOM_FACTOR = 1.25;

export interface ChartProps {
  config: ChartConfig;
  onResult?: (result: ChartResult) => void;
}

export function Chart({ config, onResult }: ChartProps): React.ReactElement {
  const { width: termWidth, height: termHeight } = useTerminalSize();
  const { exit } = useApp();

  // Merge config with defaults
  const chartConfig = useMemo(() => ({
    renderMode: 'auto' as const,
    scale: 'linear' as const,
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
    ...config,
  }), [config]);

  // Extract series from config
  const series = chartConfig.series || [];

  // Viewport state
  const { viewport, pan, zoom, reset, fitToData } = useViewport({
    series,
    config: chartConfig,
  });

  // Crosshair state
  const [showCrosshair, setShowCrosshair] = useState(chartConfig.crosshair ?? false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorData, setCursorData] = useState<{ x: number; y: number } | null>(null);

  // Calculate chart area dimensions
  const margins = chartConfig.margins!;
  const chartWidth = Math.max(20, termWidth - margins.left! - margins.right!);
  // Cap chart height to keep layout compact - max 20 rows or 50% of terminal
  const maxChartHeight = Math.min(20, Math.floor(termHeight * 0.5));
  const availableHeight = termHeight - margins.top! - margins.bottom! - (chartConfig.showLegend ? 2 : 0) - 4;
  const chartHeight = Math.max(8, Math.min(maxChartHeight, availableHeight));

  // Check if data is time series (check first series' data)
  const isTime = useMemo(() => {
    const firstSeries = series[0];
    return firstSeries ? isTimeSeries(firstSeries.data) : false;
  }, [series]);

  // Handle keyboard input
  useInput((input, key) => {
    // Exit
    if (key.escape || input === 'q') {
      onResult?.({ action: 'close', viewport });
      exit();
      return;
    }

    // Pan with arrow keys
    if (key.leftArrow) {
      pan(-PAN_STEP, 0);
      onResult?.({ action: 'pan', viewport });
    }
    if (key.rightArrow) {
      pan(PAN_STEP, 0);
      onResult?.({ action: 'pan', viewport });
    }
    if (key.upArrow) {
      pan(0, PAN_STEP);
      onResult?.({ action: 'pan', viewport });
    }
    if (key.downArrow) {
      pan(0, -PAN_STEP);
      onResult?.({ action: 'pan', viewport });
    }

    // Zoom with +/- keys
    if (input === '+' || input === '=') {
      zoom(ZOOM_FACTOR);
      onResult?.({ action: 'zoom', viewport });
    }
    if (input === '-') {
      zoom(1 / ZOOM_FACTOR);
      onResult?.({ action: 'zoom', viewport });
    }

    // Reset with 'r' or '0'
    if (input === 'r' || input === '0') {
      reset();
      onResult?.({ action: 'zoom', viewport });
    }

    // Fit to data with 'f'
    if (input === 'f') {
      fitToData();
      onResult?.({ action: 'zoom', viewport });
    }

    // Toggle crosshair with 'c'
    if (input === 'c') {
      setShowCrosshair(prev => !prev);
    }

    // Toggle grid with 'g'
    // Note: Would need to add grid toggle state to make this work

    // Toggle legend with 'l'
    // Note: Would need to add legend toggle state to make this work
  });

  // Handle mouse events
  const handleMouseMove = useCallback((event: { x: number; y: number }) => {
    if (!showCrosshair) return;

    // Convert screen position to chart area position
    const chartX = event.x - margins.left! - 1;
    const chartY = event.y - margins.top! - 1;

    // Check if within chart area
    if (chartX >= 0 && chartX < chartWidth && chartY >= 0 && chartY < chartHeight) {
      setCursorPos({ x: chartX, y: chartY });

      // Convert to data coordinates
      const data = screenToData(
        chartX,
        chartY,
        viewport,
        { width: chartWidth, height: chartHeight }
      );
      setCursorData({ x: data.x, y: data.y });
    } else {
      setCursorPos(null);
      setCursorData(null);
    }
  }, [showCrosshair, margins, chartWidth, chartHeight, viewport]);

  const handleScroll = useCallback((event: { scrollDirection: 'up' | 'down' | null; x: number; y: number }) => {
    if (!event.scrollDirection) return;

    // Convert screen position to chart area position
    const chartX = event.x - margins.left! - 1;
    const chartY = event.y - margins.top! - 1;

    // Check if within chart area
    if (chartX >= 0 && chartX < chartWidth && chartY >= 0 && chartY < chartHeight) {
      // Convert to data coordinates for zoom center
      const data = screenToData(
        chartX,
        chartY,
        viewport,
        { width: chartWidth, height: chartHeight }
      );

      // Zoom in or out
      if (event.scrollDirection === 'up') {
        zoom(ZOOM_FACTOR, data.x, data.y);
      } else {
        zoom(1 / ZOOM_FACTOR, data.x, data.y);
      }
      onResult?.({ action: 'zoom', viewport });
    }
  }, [margins, chartWidth, chartHeight, viewport, zoom, onResult]);

  const handleDrag = useCallback((start: { x: number; y: number }, current: { x: number; y: number }) => {
    // Calculate drag delta in screen coordinates
    const dx = current.x - start.x;
    const dy = current.y - start.y;

    // Convert to normalized pan amount
    const panX = -dx / chartWidth;
    const panY = dy / chartHeight;  // Y is inverted

    pan(panX, panY);
    onResult?.({ action: 'pan', viewport });
  }, [chartWidth, chartHeight, pan, viewport, onResult]);

  useMouse({
    onMove: handleMouseMove,
    onScroll: handleScroll,
    onDrag: handleDrag,
    enabled: true,
  });

  // Render
  return (
    <Box flexDirection="column" padding={0}>
      {/* Title */}
      {chartConfig.title && (
        <Box justifyContent="center" marginBottom={0}>
          <Text bold color="cyan">{chartConfig.title}</Text>
        </Box>
      )}

      {/* Main chart area with Y axis */}
      <Box flexDirection="row">
        {/* Y Axis */}
        <YAxis
          viewport={viewport}
          height={chartHeight}
          width={margins.left}
          config={chartConfig.yAxis}
        />

        {/* Chart Area */}
        <Box flexDirection="column">
          {/* Spacer to align with Y-axis label if present */}
          {chartConfig.yAxis?.label && <Box height={1} />}
          <ChartArea
            series={series}
            chartType={chartConfig.chartType}
            viewport={viewport}
            width={chartWidth}
            height={chartConfig.yAxis?.label ? chartHeight - 1 : chartHeight}
            renderMode={chartConfig.renderMode || 'auto'}
            showGrid={chartConfig.showGrid}
            crosshairX={showCrosshair && cursorPos ? cursorPos.x : undefined}
            crosshairY={showCrosshair && cursorPos ? cursorPos.y : undefined}
          />

          {/* X Axis */}
          <XAxis
            viewport={viewport}
            width={chartWidth}
            config={chartConfig.xAxis}
            offsetLeft={0}
            isTimeSeries={isTime}
          />
        </Box>
      </Box>

      {/* Legend */}
      {chartConfig.showLegend && series.length > 0 && (
        <Box marginTop={0} marginLeft={margins.left}>
          <Legend series={series} maxWidth={chartWidth} horizontal={true} />
        </Box>
      )}

      {/* Status Bar */}
      <Box marginTop={0} marginLeft={margins.left}>
        <StatusBar
          viewport={viewport}
          cursorData={cursorData || undefined}
          isTimeSeries={isTime}
          showHelp={true}
        />
      </Box>

      {/* Crosshair Tooltip */}
      {showCrosshair && cursorPos && cursorData && (
        <CrosshairTooltip
          x={cursorPos.x + margins.left!}
          y={cursorPos.y + margins.top!}
          dataX={cursorData.x}
          dataY={cursorData.y}
          isTimeSeries={isTime}
          screenWidth={termWidth}
        />
      )}
    </Box>
  );
}

// Canvas wrapper component with full props
export function ChartCanvas({
  config,
  socketPath,
  scenario,
  onResult,
}: ChartCanvasProps): React.ReactElement {
  const [chartConfig, setChartConfig] = useState<ChartConfig>(config);

  // Handle IPC updates if socketPath is provided
  useEffect(() => {
    if (!socketPath) return;

    // TODO: Implement IPC client for live updates
    // For now, just use the initial config

    return () => {
      // Cleanup IPC connection
    };
  }, [socketPath, scenario]);

  return <Chart config={chartConfig} onResult={onResult} />;
}

// Re-export types and components
export type { ChartConfig, ChartSeries, ChartCanvasProps, ChartResult } from './types';
export { useViewport } from './hooks/use-viewport';

export default Chart;
