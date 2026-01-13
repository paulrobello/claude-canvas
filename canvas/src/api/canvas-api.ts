// High-Level Canvas API for Claude
// Provides simple async interface for spawning interactive canvases

import { createIPCServer } from "../ipc/server";
import { getSocketPath } from "../ipc/types";
import { spawnCanvas } from "../terminal";
import type { CanvasMessage } from "../ipc/types";
import type {
  MeetingPickerConfig,
  MeetingPickerResult,
  DocumentConfig,
  DocumentSelection,
} from "../scenarios/types";

export interface CanvasResult<T = unknown> {
  success: boolean;
  data?: T;
  cancelled?: boolean;
  error?: string;
}

export interface SpawnOptions {
  timeout?: number; // ms, default 5 minutes
  onReady?: () => void;
}

/**
 * Spawn an interactive canvas and wait for user selection
 */
export async function spawnCanvasWithIPC<TConfig, TResult>(
  kind: string,
  scenario: string,
  config: TConfig,
  options: SpawnOptions = {}
): Promise<CanvasResult<TResult>> {
  const { timeout = 300000, onReady } = options;
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const socketPath = getSocketPath(id);

  return new Promise(async (resolve) => {
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let server: Awaited<ReturnType<typeof createIPCServer>> | null = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (server) {
        server.close();
      }
    };

    try {
      server = await createIPCServer({
        socketPath,
        onClientConnect() {
          // Canvas connected, waiting for ready message
        },
        onMessage(msg: CanvasMessage) {
          if (resolved) return;

          switch (msg.type) {
            case "ready":
              onReady?.();
              break;

            case "selected":
              resolved = true;
              cleanup();
              resolve({
                success: true,
                data: msg.data as TResult,
              });
              break;

            case "cancelled":
              resolved = true;
              cleanup();
              resolve({
                success: true,
                cancelled: true,
              });
              break;

            case "error":
              resolved = true;
              cleanup();
              resolve({
                success: false,
                error: msg.message,
              });
              break;

            case "pong":
              // Response to ping, ignore
              break;
          }
        },
        onClientDisconnect() {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({
              success: false,
              error: "Canvas disconnected unexpectedly",
            });
          }
        },
        onError(error) {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({
              success: false,
              error: error.message,
            });
          }
        },
      });

      // Set timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          server?.broadcast({ type: "close" } as any);
          cleanup();
          resolve({
            success: false,
            error: "Timeout waiting for user selection",
          });
        }
      }, timeout);

      // Spawn the canvas
      await spawnCanvas(kind, id, JSON.stringify(config), {
        socketPath,
        scenario,
      });
    } catch (err: any) {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({
          success: false,
          error: `Failed to spawn canvas: ${err.message}`,
        });
      }
    }
  });
}

/**
 * Spawn a meeting picker canvas
 * Convenience wrapper for the meeting-picker scenario
 */
export async function pickMeetingTime(
  config: MeetingPickerConfig,
  options?: SpawnOptions
): Promise<CanvasResult<MeetingPickerResult>> {
  return spawnCanvasWithIPC<MeetingPickerConfig, MeetingPickerResult>(
    "calendar",
    "meeting-picker",
    config,
    options
  );
}

/**
 * Display a calendar (non-interactive)
 * Convenience wrapper for the display scenario
 */
export async function displayCalendar(
  config: {
    title?: string;
    events?: Array<{
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      color?: string;
      allDay?: boolean;
    }>;
  },
  options?: SpawnOptions
): Promise<CanvasResult<void>> {
  return spawnCanvasWithIPC("calendar", "display", config, options);
}

// ============================================
// Document Canvas API
// ============================================

/**
 * Display a document (read-only view)
 * Shows markdown-rendered content with optional diff highlighting
 */
export async function displayDocument(
  config: DocumentConfig,
  options?: SpawnOptions
): Promise<CanvasResult<void>> {
  return spawnCanvasWithIPC("document", "display", config, options);
}

/**
 * Open a document for editing/selection
 * Returns the selected text when user makes a selection via click-and-drag
 * Selection is sent automatically as the user selects text
 */
export async function editDocument(
  config: DocumentConfig,
  options?: SpawnOptions
): Promise<CanvasResult<DocumentSelection>> {
  return spawnCanvasWithIPC<DocumentConfig, DocumentSelection>(
    "document",
    "edit",
    config,
    options
  );
}

// ============================================
// Chart Canvas API
// ============================================

export interface ChartConfig {
  title?: string;
  chartType?: 'line' | 'bar';
  series: Array<{
    id: string;
    name: string;
    data: Array<{ x: number | string; y: number; label?: string }>;
    color?: string;
    type?: 'line' | 'bar';
  }>;
  xAxis?: { label?: string; min?: number; max?: number };
  yAxis?: { label?: string; min?: number; max?: number };
  renderMode?: 'braille' | 'halfblock' | 'ascii' | 'auto';
  showGrid?: boolean;
  showLegend?: boolean;
}

export interface LiveChartHandle {
  update: (config: Partial<ChartConfig>) => void;
  addDataPoint: (seriesId: string, point: { x: number | string; y: number }) => void;
  close: () => void;
  onClose: Promise<CanvasResult<void>>;
}

/**
 * Display an interactive chart (view only)
 */
export async function displayChart(
  config: ChartConfig,
  options?: SpawnOptions
): Promise<CanvasResult<void>> {
  return spawnCanvasWithIPC("chart", "view", config, options);
}

/**
 * Spawn a live chart that can be updated dynamically
 * Returns a handle for sending updates
 */
export async function spawnLiveChart(
  config: ChartConfig,
  options: SpawnOptions = {}
): Promise<LiveChartHandle> {
  const { timeout = 300000, onReady } = options;
  const id = `chart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const socketPath = getSocketPath(id);

  let currentConfig = { ...config };
  let resolveClose: (result: CanvasResult<void>) => void;
  let resolved = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let server: Awaited<ReturnType<typeof createIPCServer>> | null = null;

  const closePromise = new Promise<CanvasResult<void>>((resolve) => {
    resolveClose = resolve;
  });

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (server) {
      server.close();
    }
  };

  // Create IPC server
  server = await createIPCServer({
    socketPath,
    onClientConnect() {
      // Canvas connected
    },
    onMessage(msg) {
      if (resolved) return;

      switch (msg.type) {
        case "ready":
          onReady?.();
          break;
        case "selected":
        case "cancelled":
          resolved = true;
          cleanup();
          resolveClose({ success: true, cancelled: msg.type === "cancelled" });
          break;
        case "error":
          resolved = true;
          cleanup();
          resolveClose({ success: false, error: (msg as any).message });
          break;
      }
    },
    onClientDisconnect() {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolveClose({ success: true });
      }
    },
    onError(error) {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolveClose({ success: false, error: error.message });
      }
    },
  });

  // Set timeout
  timeoutId = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      server?.broadcast({ type: "close" } as any);
      cleanup();
      resolveClose({ success: false, error: "Timeout" });
    }
  }, timeout);

  // Spawn the canvas
  await spawnCanvas("chart", id, JSON.stringify(config), {
    socketPath,
    scenario: "live",
  });

  return {
    update(partialConfig: Partial<ChartConfig>) {
      if (!resolved && server) {
        currentConfig = { ...currentConfig, ...partialConfig };
        server.broadcast({ type: "update", config: currentConfig } as any);
      }
    },

    addDataPoint(seriesId: string, point: { x: number | string; y: number }) {
      if (!resolved && server) {
        const series = currentConfig.series.find((s) => s.id === seriesId);
        if (series) {
          series.data.push(point);
          server.broadcast({ type: "update", config: currentConfig } as any);
        }
      }
    },

    close() {
      if (!resolved) {
        resolved = true;
        server?.broadcast({ type: "close" } as any);
        cleanup();
        resolveClose({ success: true });
      }
    },

    onClose: closePromise,
  };
}
