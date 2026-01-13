// Legend Component - Shows series names and colors

import React from 'react';
import { Box, Text } from 'ink';
import type { ChartSeries } from '../types';
import { getSeriesColor } from '../rendering';

export interface LegendProps {
  series: ChartSeries[];
  maxWidth?: number;
  horizontal?: boolean;
}

export function Legend({
  series,
  maxWidth,
  horizontal = true,
}: LegendProps): React.ReactElement {
  if (series.length === 0) {
    return <Box />;
  }

  const items = series.map((s, index) => {
    const color = getSeriesColor(index, s.color);
    const name = maxWidth ? s.name.slice(0, Math.floor(maxWidth / series.length) - 4) : s.name;

    return (
      <Box key={s.id} marginRight={horizontal ? 2 : 0}>
        <Text color={color}>■ </Text>
        <Text>{name}</Text>
      </Box>
    );
  });

  return (
    <Box
      flexDirection={horizontal ? 'row' : 'column'}
      flexWrap="wrap"
      justifyContent="center"
    >
      {items}
    </Box>
  );
}
