#!/usr/bin/env bun
// Live Chart Demo - Demonstrates dynamic chart updates

import { spawnLiveChart } from '../src/api/canvas-api';

async function main() {
  console.log('Spawning live chart...');

  const chart = await spawnLiveChart({
    title: 'Live Sensor Data',
    chartType: 'line',
    series: [
      {
        id: 'temp',
        name: 'Temperature (°C)',
        data: [{ x: 0, y: 20 }],
        color: 'red',
      },
      {
        id: 'humidity',
        name: 'Humidity (%)',
        data: [{ x: 0, y: 50 }],
        color: 'blue',
      },
    ],
    xAxis: { label: 'Time (s)' },
    yAxis: { label: 'Value' },
    showGrid: true,
    showLegend: true,
  }, {
    onReady: () => {
      console.log('Chart is ready!');
    },
  });

  console.log('Chart spawned. Updating every second...');
  console.log('Press Ctrl+C to stop, or press q in the chart.');

  let time = 1;
  const interval = setInterval(() => {
    // Generate random sensor-like data
    const temp = 20 + Math.sin(time * 0.3) * 5 + (Math.random() - 0.5) * 2;
    const humidity = 50 + Math.cos(time * 0.2) * 10 + (Math.random() - 0.5) * 5;

    // Add new data points
    chart.addDataPoint('temp', { x: time, y: Math.round(temp * 10) / 10 });
    chart.addDataPoint('humidity', { x: time, y: Math.round(humidity * 10) / 10 });

    console.log(`t=${time}s: Temp=${temp.toFixed(1)}°C, Humidity=${humidity.toFixed(1)}%`);
    time++;

    // Stop after 60 seconds
    if (time > 60) {
      clearInterval(interval);
      console.log('Demo complete. Press q in chart to close.');
    }
  }, 1000);

  // Wait for chart to close
  const result = await chart.onClose;
  clearInterval(interval);

  console.log('Chart closed:', result);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
