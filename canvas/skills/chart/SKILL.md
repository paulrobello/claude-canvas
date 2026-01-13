---
name: chart
description: |
  Interactive charts with pan/zoom - line and bar modes, braille/halfblock/ASCII rendering.
  Use when displaying data visualizations, plotting data, showing trends, or creating live-updating charts.
---

# Charts

Interactive terminal charts with high-resolution braille rendering, pan/zoom controls, and live data updates.

## Example Prompts

- "Plot these sales numbers as a line chart"
- "Show a bar chart comparing quarterly revenue"
- "Display this time series data with pan/zoom"
- "Create a chart from this CSV data"
- "Show me a live-updating chart of sensor data"

## Quick Start

```bash
cd ${CLAUDE_PLUGIN_ROOT}

# Line chart
bun run src/cli.ts show chart --config '{
  "title": "Sales Trends",
  "chartType": "line",
  "series": [
    {"id": "revenue", "name": "Revenue", "color": "cyan", "data": [
      {"x": 1, "y": 10}, {"x": 2, "y": 25}, {"x": 3, "y": 15}, {"x": 4, "y": 30}
    ]}
  ]
}'

# Bar chart
bun run src/cli.ts show chart --config '{
  "title": "Quarterly Results",
  "chartType": "bar",
  "series": [
    {"id": "q1", "name": "Q1", "color": "blue", "data": [
      {"x": "Jan", "y": 100}, {"x": "Feb", "y": 150}, {"x": "Mar", "y": 120}
    ]}
  ]
}'
```

## Chart Types

### Line Chart

Best for time series, trends, and continuous data.

```typescript
{
  "chartType": "line",
  "series": [{
    "id": "temp",
    "name": "Temperature",
    "color": "red",
    "data": [
      { "x": 0, "y": 20 },
      { "x": 1, "y": 22 },
      { "x": 2, "y": 21 }
    ]
  }]
}
```

### Bar Chart

Best for categorical comparisons.

```typescript
{
  "chartType": "bar",
  "series": [{
    "id": "sales",
    "name": "Sales",
    "color": "green",
    "data": [
      { "x": "Q1", "y": 1000 },
      { "x": "Q2", "y": 1500 },
      { "x": "Q3", "y": 1200 }
    ]
  }]
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←→↑↓` | Pan viewport |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` / `r` | Reset zoom |
| `f` | Fit to data |
| `c` | Toggle crosshair |
| `q` / `ESC` | Exit |

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `title` | string | Chart title |
| `chartType` | `"line"` \| `"bar"` | Chart type |
| `series` | array | Data series array |
| `renderMode` | `"braille"` \| `"halfblock"` \| `"ascii"` \| `"auto"` | Rendering style (default: auto) |
| `showGrid` | boolean | Show grid lines |
| `showLegend` | boolean | Show legend |
| `crosshair` | boolean | Enable crosshair cursor |
| `xAxis` | object | X-axis configuration |
| `yAxis` | object | Y-axis configuration |

### Series Configuration

```typescript
{
  "id": "unique-id",
  "name": "Display Name",
  "color": "cyan",  // red, green, blue, yellow, magenta, cyan, white
  "data": [
    { "x": number | string, "y": number }
  ]
}
```

### Axis Configuration

```typescript
{
  "label": "Axis Label",
  "min": 0,
  "max": 100,
  "format": "datetime"  // For time series
}
```

## Live Charts (Dynamic Updates)

Charts support real-time data updates via IPC.

### API Usage

```typescript
import { spawnLiveChart } from "./api/canvas-api";

// Spawn a live chart
const chart = await spawnLiveChart({
  title: "Live Sensor Data",
  chartType: "line",
  series: [
    { id: "temp", name: "Temperature", data: [], color: "red" }
  ]
}, {
  onReady: () => console.log("Chart ready!")
});

// Add data points
chart.addDataPoint("temp", { x: 1, y: 22.5 });
chart.addDataPoint("temp", { x: 2, y: 23.1 });

// Update configuration
chart.update({ title: "Updated Title" });

// Close when done
chart.close();
```

### CLI Update

```bash
# Update a running chart
bun run src/cli.ts update chart-id --config '{
  "series": [{"id": "temp", "data": [...]}]
}'
```

## Render Modes

| Mode | Resolution | Best For |
|------|------------|----------|
| `braille` | 2x4 dots per cell | High detail, modern terminals |
| `halfblock` | 1x2 per cell | Good compatibility |
| `ascii` | 1x1 per cell | Maximum compatibility |
| `auto` | Auto-detect | Recommended default |

## Time Series

For time-based data, use ISO date strings:

```typescript
{
  "chartType": "line",
  "xAxis": { "format": "datetime" },
  "series": [{
    "id": "cpu",
    "name": "CPU Usage",
    "data": [
      { "x": "2024-01-15T10:00:00Z", "y": 45 },
      { "x": "2024-01-15T10:05:00Z", "y": 62 },
      { "x": "2024-01-15T10:10:00Z", "y": 55 }
    ]
  }]
}
```

## Requirements

- **tmux**: For spawning in split pane
- **Terminal with Unicode support**: For braille/halfblock rendering
- **Bun**: Runtime for executing commands
