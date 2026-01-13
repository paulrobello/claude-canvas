#!/usr/bin/env bun
import { program } from "commander";
import { detectTerminal, spawnCanvas, getTerminalInfo, captureCanvasPane, getCurrentCanvasPaneId } from "./terminal";
import { isWindows, getSocketPath, getPortFilePath } from "./ipc/types";
import { existsSync } from "node:fs";

// Set window title via ANSI escape codes
function setWindowTitle(title: string) {
  process.stdout.write(`\x1b]0;${title}\x07`);
}

program
  .name("claude-canvas")
  .description("Interactive terminal canvases for Claude")
  .version("1.0.0");

program
  .command("show [kind]")
  .description("Show a canvas in the current terminal")
  .option("--id <id>", "Canvas ID")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--config-file <path>", "Path to config file (JSON)")
  .option("--socket <path>", "Socket path for IPC (Unix) or socket identifier (Windows)")
  .option("--scenario <name>", "Scenario name (e.g., display, meeting-picker)")
  .action(async (kind = "demo", options) => {
    const id = options.id || `${kind}-1`;

    // Load config from file or inline JSON
    let config: unknown;
    if (options.configFile) {
      try {
        const file = Bun.file(options.configFile);
        const content = await file.text();
        config = JSON.parse(content);
      } catch (e) {
        console.error(`Failed to load config file: ${options.configFile}`);
        process.exit(1);
      }
    } else if (options.config) {
      config = JSON.parse(options.config);
    }

    const socketPath = options.socket;
    const scenario = options.scenario || "display";

    // Set window title
    setWindowTitle(`canvas: ${kind}`);

    // Dynamically import and render the canvas
    const { renderCanvas } = await import("./canvases");
    await renderCanvas(kind, id, config, { socketPath, scenario });
  });

program
  .command("spawn [kind]")
  .description("Spawn a canvas in a new terminal window/pane")
  .option("--id <id>", "Canvas ID")
  .option("--config <json>", "Canvas configuration (JSON)")
  .option("--config-file <path>", "Path to config file (JSON)")
  .option("--socket <path>", "Socket path for IPC")
  .option("--scenario <name>", "Scenario name (e.g., display, meeting-picker)")
  .option("--wait", "Wait for canvas response and output as JSON")
  .option("--timeout <ms>", "Timeout in milliseconds for --wait (default: no timeout)")
  .action(async (kind = "demo", options) => {
    const id = options.id || `${kind}-1`;

    // Load config from file or inline JSON
    let configJson: string | undefined;
    if (options.configFile) {
      try {
        const file = Bun.file(options.configFile);
        configJson = await file.text();
      } catch (e) {
        console.error(`Failed to load config file: ${options.configFile}`);
        process.exit(1);
      }
    } else if (options.config) {
      configJson = options.config;
    }

    const result = await spawnCanvas(kind, id, configJson, {
      socketPath: options.socket,
      scenario: options.scenario,
    });

    if (options.wait) {
      // Wait for canvas to send a terminal message (gmail, selected, cancelled, error)
      const socketPath = getSocketPath(id);
      const timeout = options.timeout ? parseInt(options.timeout, 10) : undefined;

      try {
        const message = await waitForCanvasMessage(id, socketPath, timeout);
        console.log(JSON.stringify(message));
      } catch (err) {
        console.error(JSON.stringify({ type: "error", message: String(err) }));
        process.exit(1);
      }
    } else {
      console.log(`Spawned ${kind} canvas '${id}' via ${result.method}`);
    }
  });

program
  .command("env")
  .description("Show detected terminal environment")
  .action(() => {
    const env = detectTerminal();
    const info = getTerminalInfo();

    console.log("Terminal Environment:");
    console.log(`  Platform: ${info.platform}`);
    console.log(`  Terminal: ${info.terminal}`);
    console.log(`  Can split panes: ${info.canSplit}`);

    if (isWindows) {
      console.log(`  In Windows Terminal: ${env.inWindowsTerminal}`);
      console.log(`  WT_SESSION: ${process.env.WT_SESSION || "(not set)"}`);
    } else {
      console.log(`  In tmux: ${env.inTmux}`);
      console.log(`  TMUX: ${process.env.TMUX || "(not set)"}`);
    }

    console.log(`\nSummary: ${env.summary}`);
  });

program
  .command("capture")
  .description("Capture the canvas pane output (terminal vision)")
  .option("--pane <id>", "Specific tmux pane ID to capture")
  .option("--history", "Include scrollback history")
  .option("--escape", "Include ANSI escape sequences (colors)")
  .option("--json", "Output as JSON with metadata")
  .action(async (options) => {
    const result = await captureCanvasPane({
      paneId: options.pane,
      history: options.history,
      escape: options.escape,
    });

    if (!result.success) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify({
        success: true,
        paneId: result.paneId,
        content: result.content,
        lines: result.content?.split("\n").length || 0,
      }, null, 2));
    } else {
      console.log(result.content);
    }
  });

program
  .command("pane-id")
  .description("Get the current canvas pane ID")
  .action(async () => {
    const paneId = await getCurrentCanvasPaneId();
    if (paneId) {
      console.log(paneId);
    } else {
      console.error("No canvas pane found");
      process.exit(1);
    }
  });

program
  .command("update <id>")
  .description("Send updated config to a running canvas via IPC")
  .option("--config <json>", "New canvas configuration (JSON)")
  .action(async (id: string, options) => {
    const socketPath = getSocketPath(id);
    const config = options.config ? JSON.parse(options.config) : {};

    try {
      await connectAndSend(id, socketPath, { type: "update", config });
      console.log(`Sent update to canvas '${id}'`);
    } catch (err) {
      console.error(`Failed to connect to canvas '${id}':`, err);
    }
  });

program
  .command("selection <id>")
  .description("Get the current selection from a running document canvas")
  .action(async (id: string) => {
    const socketPath = getSocketPath(id);

    try {
      const result = await sendAndReceive(id, socketPath, { type: "getSelection" });
      if (result && result.type === "selection") {
        console.log(JSON.stringify(result.data));
      } else {
        console.log(JSON.stringify(null));
      }
    } catch (err) {
      console.error(`Failed to get selection from canvas '${id}':`, err);
      process.exit(1);
    }
  });

program
  .command("content <id>")
  .description("Get the current content from a running document canvas")
  .action(async (id: string) => {
    const socketPath = getSocketPath(id);

    try {
      const result = await sendAndReceive(id, socketPath, { type: "getContent" });
      if (result && result.type === "content") {
        console.log(JSON.stringify(result.data));
      } else {
        console.log(JSON.stringify(null));
      }
    } catch (err) {
      console.error(`Failed to get content from canvas '${id}':`, err);
      process.exit(1);
    }
  });

// ============================================
// Cross-platform IPC helpers
// ============================================

// Terminal message types that indicate canvas completion
const TERMINAL_MESSAGE_TYPES = ["gmail", "selected", "cancelled", "error"];

async function waitForCanvasMessage(
  id: string,
  socketPath: string,
  timeout?: number
): Promise<unknown> {
  // Wait for socket to be available (canvas may still be starting)
  const maxRetries = 50;
  const retryDelay = 100;
  let conn: Awaited<ReturnType<typeof getConnection>> | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      conn = await getConnection(id, socketPath);
      break;
    } catch {
      await Bun.sleep(retryDelay);
    }
  }

  if (!conn) {
    throw new Error(`Canvas '${id}' did not start within ${maxRetries * retryDelay}ms`);
  }

  return new Promise((resolve, reject) => {
    let resolved = false;
    let buffer = "";
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeout) {
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Timeout waiting for canvas response after ${timeout}ms`));
        }
      }, timeout);
    }

    const socketHandlers = {
      data(socket: any, data: any) {
        if (resolved) return;

        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const message = JSON.parse(line);
            // Skip "ready" and "pong" messages, wait for terminal messages
            if (TERMINAL_MESSAGE_TYPES.includes(message.type)) {
              resolved = true;
              if (timeoutId) clearTimeout(timeoutId);
              socket.end();
              resolve(message);
              return;
            }
          } catch {
            // Ignore malformed JSON
          }
        }
      },
      open() {
        // Just wait for messages, don't send anything
      },
      close() {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(new Error("Canvas closed without sending a response"));
        }
      },
      error(socket: any, error: Error) {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        }
      },
    };

    // Connect to canvas IPC
    if (conn.type === "tcp") {
      Bun.connect({
        hostname: conn.host!,
        port: conn.port!,
        socket: socketHandlers,
      }).catch((err) => {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(err);
        }
      });
    } else {
      Bun.connect({
        unix: conn.socketPath!,
        socket: socketHandlers,
      }).catch((err) => {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(err);
        }
      });
    }
  });
}

async function getConnection(id: string, socketPath: string): Promise<{
  type: "unix" | "tcp";
  socketPath?: string;
  host?: string;
  port?: number;
}> {
  if (isWindows) {
    // On Windows, read port from port file
    const portFile = getPortFilePath(id);
    const file = Bun.file(portFile);

    if (!(await file.exists())) {
      throw new Error(`Port file not found: ${portFile}`);
    }

    const port = parseInt((await file.text()).trim(), 10);
    if (isNaN(port)) {
      throw new Error(`Invalid port in port file: ${portFile}`);
    }

    return { type: "tcp", host: "127.0.0.1", port };
  } else {
    // On Unix, verify socket exists (use existsSync since Bun.file doesn't work for sockets)
    if (!existsSync(socketPath)) {
      throw new Error(`Socket not found: ${socketPath}`);
    }
    return { type: "unix", socketPath };
  }
}

async function connectAndSend(id: string, socketPath: string, message: unknown): Promise<void> {
  const conn = await getConnection(id, socketPath);

  if (conn.type === "tcp") {
    const socket = await Bun.connect({
      hostname: conn.host!,
      port: conn.port!,
      socket: {
        data() {},
        open(socket) {
          const msg = JSON.stringify(message);
          socket.write(msg + "\n");
          socket.end();
        },
        close() {},
        error(socket, error) {
          console.error("Socket error:", error);
        },
      },
    });
  } else {
    const socket = await Bun.connect({
      unix: conn.socketPath!,
      socket: {
        data() {},
        open(socket) {
          const msg = JSON.stringify(message);
          socket.write(msg + "\n");
          socket.end();
        },
        close() {},
        error(socket, error) {
          console.error("Socket error:", error);
        },
      },
    });
  }
}

async function sendAndReceive(id: string, socketPath: string, message: unknown): Promise<any> {
  const conn = await getConnection(id, socketPath);

  return new Promise(async (resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Timeout waiting for response"));
      }
    }, 2000);

    const socketHandlers = {
      data(socket: any, data: any) {
        if (resolved) return;
        clearTimeout(timeout);
        resolved = true;
        try {
          const response = JSON.parse(data.toString().trim());
          resolve(response);
        } catch {
          resolve(null);
        }
        socket.end();
      },
      open(socket: any) {
        const msg = JSON.stringify(message);
        socket.write(msg + "\n");
      },
      close() {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(null);
        }
      },
      error(socket: any, error: Error) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      },
    };

    try {
      if (conn.type === "tcp") {
        await Bun.connect({
          hostname: conn.host!,
          port: conn.port!,
          socket: socketHandlers,
        });
      } else {
        await Bun.connect({
          unix: conn.socketPath!,
          socket: socketHandlers,
        });
      }
    } catch (err) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    }
  });
}

program.parse();
