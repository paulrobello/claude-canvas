// Chart IPC Hook - Handles dynamic updates via IPC

import { useState, useEffect, useRef } from 'react';
import type { ChartConfig, ChartResult } from '../types';
import type { CanvasMessage, ControllerMessage } from '../../../ipc/types';

// Simple IPC client that connects to the server
interface IPCClient {
  send: (msg: CanvasMessage) => void;
  close: () => void;
}

export interface UseChartIpcOptions {
  socketPath?: string;
  scenario?: string;
  initialConfig: ChartConfig;
  onResult?: (result: ChartResult) => void;
}

export interface UseChartIpcReturn {
  config: ChartConfig;
  isConnected: boolean;
}

export function useChartIpc({
  socketPath,
  scenario = 'view',
  initialConfig,
  onResult,
}: UseChartIpcOptions): UseChartIpcReturn {
  const [config, setConfig] = useState<ChartConfig>(initialConfig);
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<IPCClient | null>(null);

  // Connect to IPC server
  useEffect(() => {
    if (!socketPath) return;

    let mounted = true;
    let socket: ReturnType<typeof Bun.connect> extends Promise<infer T> ? T : never;
    let buffer = '';

    const handleMessage = (msg: ControllerMessage) => {
      switch (msg.type) {
        case 'update':
          if (msg.config) {
            setConfig((prev) => ({
              ...prev,
              ...(msg.config as Partial<ChartConfig>),
            }));
          }
          break;

        case 'close':
          onResult?.({ action: 'close' });
          break;

        case 'ping':
          clientRef.current?.send({ type: 'pong' });
          break;
      }
    };

    const connect = async () => {
      try {
        socket = await Bun.connect({
          unix: socketPath,
          socket: {
            open(sock: any) {
              if (mounted) {
                setIsConnected(true);
                sock.write(JSON.stringify({ type: 'ready', scenario } as CanvasMessage) + '\n');
              }
            },
            data(sock: any, data: any) {
              buffer += data.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const msg = JSON.parse(line) as ControllerMessage;
                    handleMessage(msg);
                  } catch {
                    // Ignore parse errors
                  }
                }
              }
            },
            close() {
              if (mounted) {
                setIsConnected(false);
              }
            },
            error() {
              // Ignore socket errors
            },
          },
        });

        if (mounted) {
          clientRef.current = {
            send(msg: CanvasMessage) {
              socket.write(JSON.stringify(msg) + '\n');
            },
            close() {
              socket.end();
            },
          };
        }
      } catch {
        // Connection failed
      }
    };

    connect();

    return () => {
      mounted = false;
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, [socketPath, scenario, onResult]);

  // Update config when initialConfig changes
  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  return {
    config,
    isConnected,
  };
}
