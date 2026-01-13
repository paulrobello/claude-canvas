// Document Canvas - Markdown editor with syntax highlighting

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { useIPCServer } from "./calendar/hooks/use-ipc-server";
import { useMouse } from "./calendar/hooks/use-mouse";
import { RawMarkdownRenderer } from "./document/components/raw-markdown-renderer";
import { TtyTableRenderer } from "./document/components/tty-table-renderer";
import { EmailHeader } from "./document/components/email-header";
import type { DocumentConfig, EmailConfig } from "./document/types";

/**
 * Build a Gmail compose URL with pre-filled fields.
 * Uses the Gmail compose URL format: https://mail.google.com/mail/?view=cm&...
 * Handles URL length limits by truncating body if necessary.
 */
function buildGmailComposeUrl(params: {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
}): { url: string; truncated: boolean } {
  // Safe URL length limit (conservative, works across all browsers)
  const MAX_URL_LENGTH = 2000;
  const base = "https://mail.google.com/mail/?view=cm";

  // Build non-body params first (these take priority)
  const fixedParams: string[] = [];
  if (params.to?.length) {
    fixedParams.push(`to=${encodeURIComponent(params.to.join(","))}`);
  }
  if (params.cc?.length) {
    fixedParams.push(`cc=${encodeURIComponent(params.cc.join(","))}`);
  }
  if (params.bcc?.length) {
    fixedParams.push(`bcc=${encodeURIComponent(params.bcc.join(","))}`);
  }
  if (params.subject) {
    fixedParams.push(`su=${encodeURIComponent(params.subject)}`);
  }

  // Calculate remaining space for body
  const baseWithParams = fixedParams.length > 0
    ? `${base}&${fixedParams.join("&")}`
    : base;

  let truncated = false;
  let body = params.body || "";

  if (body) {
    // Calculate how much space we have for the body parameter
    // Format: &body=<encoded_body>
    const bodyPrefix = "&body=";
    const availableLength = MAX_URL_LENGTH - baseWithParams.length - bodyPrefix.length;

    // Encode and check length
    let encodedBody = encodeURIComponent(body);
    if (encodedBody.length > availableLength) {
      // Truncate the original body and re-encode
      // Binary search for the right length (encoding expands the string unpredictably)
      let low = 0;
      let high = body.length;
      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const testEncoded = encodeURIComponent(body.slice(0, mid) + "...[truncated]");
        if (testEncoded.length <= availableLength) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      body = body.slice(0, low) + "...[truncated]";
      encodedBody = encodeURIComponent(body);
      truncated = true;
    }

    const url = `${baseWithParams}${bodyPrefix}${encodedBody}`;
    return { url, truncated };
  }

  return { url: baseWithParams, truncated: false };
}

/**
 * Open a URL in the default browser (cross-platform).
 */
async function openUrl(url: string): Promise<void> {
  const platform = process.platform;
  if (platform === "darwin") {
    await Bun.$`open ${url}`.quiet();
  } else if (platform === "win32") {
    await Bun.$`cmd /c start "" ${url}`.quiet();
  } else {
    // Linux and others
    await Bun.$`xdg-open ${url}`.quiet();
  }
}

interface Props {
  id: string;
  config?: DocumentConfig;
  socketPath?: string;
  scenario?: string;
}

export function Document({ id, config: initialConfig, socketPath, scenario = "display" }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Terminal dimensions
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });

  // Scroll state
  const [scrollOffset, setScrollOffset] = useState(0);

  // Rendered line count (for rendered mode scrolling)
  const [renderedLineCount, setRenderedLineCount] = useState(0);

  // Cursor position (character offset in content)
  const [cursorPosition, setCursorPosition] = useState(0);

  // Selection state (null means no selection, just cursor)
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);

  // Mouse dragging state
  const isDraggingRef = useRef(false);

  // Live config state (can be updated via IPC)
  const [liveConfig, setLiveConfig] = useState<DocumentConfig | undefined>(initialConfig);

  // IPC for communicating with Claude (server mode for CLI)
  const ipc = useIPCServer({
    socketPath,
    scenario: scenario || "display",
    onClose: () => exit(),
    onUpdate: (newConfig) => {
      setLiveConfig(newConfig as DocumentConfig);
    },
    onGetSelection: () => {
      if (selectionStart === null || selectionEnd === null) return null;
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);
      if (start === end) return null;
      return {
        selectedText: content.slice(start, end),
        startOffset: start,
        endOffset: end,
      };
    },
    onGetContent: () => ({
      content,
      cursorPosition,
    }),
  });

  // Check if this is an email preview scenario
  const isEmailPreview = scenario === "email-preview";

  // Check if using rendered markdown view (initial state)
  const initialRenderedView = scenario === "rendered";

  // View mode toggle state (for switching between raw and rendered)
  const [viewMode, setViewMode] = useState<"raw" | "rendered">(
    initialRenderedView ? "rendered" : "raw"
  );

  // Current view state
  const isRenderedView = viewMode === "rendered";

  // Config with defaults
  // Full width for display, rendered, and email-preview scenarios
  const isToggleableView = scenario === "display" || scenario === "rendered";
  const shouldDefaultFullWidth = isToggleableView || isEmailPreview;
  const {
    content: rawContent = "# Welcome\n\nNo content provided.",
    title,
    diffs = [],
    readOnly = scenario === "display" || isEmailPreview || initialRenderedView,
    fullWidth = shouldDefaultFullWidth,
    renderer = viewMode,
  } = liveConfig || {};

  // Normalize content: convert literal \n to actual newlines (common in CLI/JSON input)
  const initialContent = rawContent.replace(/\\n/g, "\n");

  // Email-specific fields (only used in email-preview scenario)
  const emailConfig = liveConfig as EmailConfig | undefined;
  const emailFrom = emailConfig?.from || "";
  const emailTo = emailConfig?.to || [];
  const emailCc = emailConfig?.cc;
  const emailBcc = emailConfig?.bcc;
  const emailSubject = emailConfig?.subject || "";

  // Editable content state
  const [content, setContent] = useState(initialContent);

  // Sync content when liveConfig changes (normalize literal \n)
  useEffect(() => {
    if (liveConfig?.content) {
      setContent(liveConfig.content.replace(/\\n/g, "\n"));
    }
  }, [liveConfig?.content]);

  // Listen for terminal resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: stdout?.columns || 120,
        height: stdout?.rows || 40,
      });
    };
    stdout?.on("resize", updateDimensions);
    updateDimensions();
    return () => {
      stdout?.off("resize", updateDimensions);
    };
  }, [stdout]);

  // Calculate layout
  const termWidth = dimensions.width;
  const termHeight = dimensions.height;
  const maxDocWidth = fullWidth ? termWidth - 4 : 80;
  const docWidth = Math.min(termWidth - 4, maxDocWidth);
  const headerHeight = 3;
  const footerHeight = 2;
  // Email header takes extra lines: from, to, cc (optional), bcc (optional), subject, separator
  const emailHeaderLines = isEmailPreview
    ? 3 + (emailCc && emailCc.length > 0 ? 1 : 0) + (emailBcc && emailBcc.length > 0 ? 1 : 0) + 2
    : 0;
  const viewportHeight = termHeight - headerHeight - footerHeight - emailHeaderLines - 2;

  // Line count and max scroll
  const rawLineCount = content.split("\n").length;
  const totalLines = isRenderedView && renderedLineCount > 0 ? renderedLineCount : rawLineCount;
  const maxScroll = Math.max(0, totalLines - viewportHeight);

  // Calculate content area offset for mouse coordinates
  const leftPadding = Math.max(0, Math.floor((termWidth - docWidth) / 2));
  const contentStartCol = leftPadding + 1 + 2 + 1; // border + paddingX + 1 adjustment
  const contentStartRow = headerHeight + 1 + 1; // title + marginBottom + border + padding

  // Helper: convert terminal coordinates to content offset
  const terminalToOffset = useCallback((termX: number, termY: number): number => {
    const lines = content.split("\n");

    // Adjust for content area offset and scroll
    const col = termX - contentStartCol;
    const row = termY - contentStartRow + scrollOffset;

    // Clamp row to valid range
    const clampedRow = Math.max(0, Math.min(row, lines.length - 1));

    // Calculate character offset
    let offset = 0;
    for (let i = 0; i < clampedRow; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }

    // Add column offset, clamped to line length
    const lineLength = lines[clampedRow]?.length || 0;
    offset += Math.max(0, Math.min(col, lineLength));

    return Math.min(offset, content.length);
  }, [content, contentStartCol, contentStartRow, scrollOffset]);

  // Mouse handlers
  const handleMouseClick = useCallback((event: { x: number; y: number }) => {
    if (readOnly) return;

    const offset = terminalToOffset(event.x, event.y);
    setCursorPosition(offset);
    setSelectionStart(offset);
    setSelectionEnd(null);
    isDraggingRef.current = true;
  }, [readOnly, terminalToOffset]);

  const handleMouseMove = useCallback((event: { x: number; y: number }) => {
    if (readOnly || !isDraggingRef.current) return;

    const offset = terminalToOffset(event.x, event.y);
    setSelectionEnd(offset);
    setCursorPosition(offset);
  }, [readOnly, terminalToOffset]);

  const handleMouseRelease = useCallback(() => {
    isDraggingRef.current = false;
    // If selection start equals end, clear selection (just a click)
    if (selectionStart !== null && selectionEnd !== null && selectionStart === selectionEnd) {
      setSelectionEnd(null);
    }
  }, [selectionStart, selectionEnd]);

  // Scroll handler - works in both read-only and edit modes
  const handleScroll = useCallback((event: { scrollDirection: "up" | "down" | null }) => {
    if (event.scrollDirection === "up") {
      setScrollOffset((o) => Math.max(0, o - 3)); // 3 lines per scroll tick
    } else if (event.scrollDirection === "down") {
      setScrollOffset((o) => Math.min(maxScroll, o + 3));
    }
  }, [maxScroll]);

  // Use mouse hook - scroll enabled always, click/drag only in edit mode
  useMouse({
    enabled: true, // Enable for scroll support in all modes
    onClick: readOnly ? undefined : handleMouseClick,
    onMove: readOnly ? undefined : handleMouseMove,
    onRelease: readOnly ? undefined : handleMouseRelease,
    onScroll: handleScroll,
  });

  // Helper: get normalized selection bounds
  const getSelectionBounds = useCallback(() => {
    if (selectionStart === null || selectionEnd === null) return null;
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    if (start === end) return null;
    return { start, end };
  }, [selectionStart, selectionEnd]);

  // Helper: delete selection and return new text with cursor position
  const deleteSelection = useCallback(() => {
    const bounds = getSelectionBounds();
    if (!bounds) return null;

    const newText = content.slice(0, bounds.start) + content.slice(bounds.end);
    return { newText, newCursor: bounds.start };
  }, [content, getSelectionBounds]);

  // Helper: clear selection
  const clearSelection = useCallback(() => {
    setSelectionStart(null);
    setSelectionEnd(null);
  }, []);

  // Helper: get cursor line from position
  const getCursorLine = useCallback((pos: number, text: string) => {
    let line = 0;
    for (let i = 0; i < pos && i < text.length; i++) {
      if (text[i] === "\n") line++;
    }
    return line;
  }, []);

  // Helper: ensure cursor is visible by adjusting scroll
  const ensureCursorVisible = useCallback((pos: number, text: string) => {
    const cursorLine = getCursorLine(pos, text);
    setScrollOffset((offset) => {
      if (cursorLine < offset) return cursorLine;
      if (cursorLine >= offset + viewportHeight) return cursorLine - viewportHeight + 1;
      return offset;
    });
  }, [getCursorLine, viewportHeight]);

  // Keyboard controls
  useInput((input, key) => {
    // Ignore mouse escape sequence fragments that leak through
    // These look like: <, [, digits, ;, M, m, etc. from \x1b[<btn;x;y[Mm]
    if (input && /^[<\[\];Mm\d]+$/.test(input)) {
      return;
    }

    // Quit with Escape
    if (key.escape) {
      // In edit mode with selection, first Escape clears selection
      if (!readOnly && getSelectionBounds()) {
        clearSelection();
        return;
      }
      ipc.sendCancelled("User quit");
      exit();
      return;
    }

    // Toggle view mode with 'v' key (in display/rendered scenarios)
    if (input === "v" && (scenario === "display" || scenario === "rendered")) {
      setViewMode((mode) => mode === "raw" ? "rendered" : "raw");
      setScrollOffset(0); // Reset scroll when switching views
      return;
    }

    // Open in Gmail with Ctrl+G (in email-preview scenario)
    if (key.ctrl && input === "g" && isEmailPreview) {
      // Build Gmail compose URL and open directly
      const { url, truncated } = buildGmailComposeUrl({
        to: emailTo,
        cc: emailCc,
        bcc: emailBcc,
        subject: emailSubject,
        body: content,
      });

      // Open Gmail in browser (don't await - fire and forget)
      openUrl(url).catch(() => {
        // Silently ignore errors - browser may not open in some environments
      });

      // Also notify via IPC (for logging/notification if controller is listening)
      ipc.sendGmail({
        to: emailTo,
        cc: emailCc,
        bcc: emailBcc,
        subject: emailSubject,
        content: truncated ? content + "\n\n[Note: Body was truncated in Gmail URL]" : content,
      });

      exit();
      return;
    }

    // In read-only mode, only allow scrolling
    if (readOnly) {
      if (key.upArrow) {
        setScrollOffset((o) => Math.max(0, o - 1));
      } else if (key.downArrow) {
        setScrollOffset((o) => Math.min(maxScroll, o + 1));
      } else if (key.pageUp) {
        setScrollOffset((o) => Math.max(0, o - viewportHeight));
      } else if (key.pageDown) {
        setScrollOffset((o) => Math.min(maxScroll, o + viewportHeight));
      }
      return;
    }

    // Edit mode
    const text = content;
    const pos = cursorPosition;
    const selection = getSelectionBounds();

    // Arrow keys - cursor movement (clears selection)
    if (key.leftArrow) {
      const newPos = selection ? selection.start : Math.max(0, pos - 1);
      setCursorPosition(newPos);
      clearSelection();
      ensureCursorVisible(newPos, text);
      return;
    }
    if (key.rightArrow) {
      const newPos = selection ? selection.end : Math.min(text.length, pos + 1);
      setCursorPosition(newPos);
      clearSelection();
      ensureCursorVisible(newPos, text);
      return;
    }
    if (key.upArrow) {
      clearSelection();
      // Move to same column on previous line
      const lines = text.split("\n");
      let currentLine = 0;
      let colInLine = 0;
      for (let i = 0; i < pos; i++) {
        if (text[i] === "\n") {
          currentLine++;
          colInLine = 0;
        } else {
          colInLine++;
        }
      }
      if (currentLine > 0) {
        let newPos = 0;
        for (let l = 0; l < currentLine - 1; l++) {
          newPos += lines[l].length + 1;
        }
        newPos += Math.min(colInLine, lines[currentLine - 1].length);
        setCursorPosition(newPos);
        ensureCursorVisible(newPos, text);
      }
      return;
    }
    if (key.downArrow) {
      clearSelection();
      // Move to same column on next line
      const lines = text.split("\n");
      let currentLine = 0;
      let colInLine = 0;
      for (let i = 0; i < pos; i++) {
        if (text[i] === "\n") {
          currentLine++;
          colInLine = 0;
        } else {
          colInLine++;
        }
      }
      if (currentLine < lines.length - 1) {
        let newPos = 0;
        for (let l = 0; l <= currentLine; l++) {
          newPos += lines[l].length + 1;
        }
        newPos += Math.min(colInLine, lines[currentLine + 1].length);
        setCursorPosition(Math.min(newPos, text.length));
        ensureCursorVisible(Math.min(newPos, text.length), text);
      }
      return;
    }

    // Page up/down for scrolling
    if (key.pageUp) {
      setScrollOffset((o) => Math.max(0, o - viewportHeight));
      return;
    }
    if (key.pageDown) {
      setScrollOffset((o) => Math.min(maxScroll, o + viewportHeight));
      return;
    }

    // Backspace - delete selection or previous char
    if (key.backspace || key.delete) {
      if (selection) {
        // Delete selection
        const result = deleteSelection();
        if (result) {
          setContent(result.newText);
          setCursorPosition(result.newCursor);
          clearSelection();
          ensureCursorVisible(result.newCursor, result.newText);
        }
      } else if (pos > 0) {
        const newText = text.slice(0, pos - 1) + text.slice(pos);
        setContent(newText);
        setCursorPosition(pos - 1);
        ensureCursorVisible(pos - 1, newText);
      }
      return;
    }

    // Enter - replace selection or insert newline
    if (key.return) {
      if (selection) {
        const result = deleteSelection();
        if (result) {
          const newText = result.newText.slice(0, result.newCursor) + "\n" + result.newText.slice(result.newCursor);
          setContent(newText);
          setCursorPosition(result.newCursor + 1);
          clearSelection();
          ensureCursorVisible(result.newCursor + 1, newText);
        }
      } else {
        const newText = text.slice(0, pos) + "\n" + text.slice(pos);
        setContent(newText);
        setCursorPosition(pos + 1);
        ensureCursorVisible(pos + 1, newText);
      }
      return;
    }

    // Regular character input - replace selection or insert
    if (input && !key.ctrl && !key.meta) {
      if (selection) {
        const result = deleteSelection();
        if (result) {
          const newText = result.newText.slice(0, result.newCursor) + input + result.newText.slice(result.newCursor);
          setContent(newText);
          setCursorPosition(result.newCursor + input.length);
          clearSelection();
          ensureCursorVisible(result.newCursor + input.length, newText);
        }
      } else {
        const newText = text.slice(0, pos) + input + text.slice(pos);
        setContent(newText);
        setCursorPosition(pos + input.length);
        ensureCursorVisible(pos + input.length, newText);
      }
      return;
    }
  });

  // Scroll indicator
  const scrollPercent = maxScroll > 0 ? Math.round((scrollOffset / maxScroll) * 100) : 100;

  // Calculate cursor line and column for display
  const cursorLine = getCursorLine(cursorPosition, content);
  let cursorCol = 0;
  let charCount = 0;
  for (const line of content.split("\n")) {
    if (charCount + line.length >= cursorPosition) {
      cursorCol = cursorPosition - charCount;
      break;
    }
    charCount += line.length + 1;
  }

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      {/* Title bar - centered */}
      <Box justifyContent="center" marginBottom={1}>
        <Box width={docWidth}>
          <Text bold color="white">
            {isEmailPreview ? "Email Preview" : (title || "Document")}
          </Text>
          {(scenario === "display" || scenario === "rendered") && (
            <Text color={isRenderedView ? "green" : "yellow"} dimColor>
              {" "}[{isRenderedView ? "rendered" : "raw"}]
            </Text>
          )}
          <Box flexGrow={1} />
          <Text color="gray" dimColor>
            {totalLines > viewportHeight ? `${scrollPercent}%` : ""}
          </Text>
        </Box>
      </Box>

      {/* Document with border - centered */}
      <Box justifyContent="center" flexGrow={1}>
        <Box
          width={docWidth}
          flexDirection="column"
          borderStyle="round"
          borderColor={isEmailPreview ? "blue" : "green"}
          paddingX={2}
          paddingY={1}
        >
          {/* Email header for email-preview scenario */}
          {isEmailPreview && (
            <EmailHeader
              from={emailFrom}
              to={emailTo}
              cc={emailCc}
              bcc={emailBcc}
              subject={emailSubject}
              width={docWidth - 6}
            />
          )}
          {renderer === "rendered" ? (
            <TtyTableRenderer
              content={content}
              terminalWidth={docWidth - 6}
              scrollOffset={scrollOffset}
              viewportHeight={viewportHeight}
              onLineCountChange={setRenderedLineCount}
            />
          ) : (
            <RawMarkdownRenderer
              content={content}
              cursorPosition={readOnly ? undefined : cursorPosition}
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
              scrollOffset={scrollOffset}
              viewportHeight={viewportHeight}
              terminalWidth={docWidth - 6}
            />
          )}
        </Box>
      </Box>

      {/* Status bar - single line, centered */}
      <Box justifyContent="center">
        <Box width={docWidth} justifyContent="space-between">
          <Text color="gray" dimColor>
            {readOnly
              ? isEmailPreview
                ? "↑↓/scroll • ^G Gmail • Esc quit"
                : (scenario === "display" || scenario === "rendered")
                  ? `↑↓/scroll • v toggle view • Esc quit`
                  : "↑↓/scroll to navigate • Esc quit"
              : isEmailPreview
                ? "click/drag select • ↑↓ scroll • ^G Gmail • Esc quit"
                : "click/drag select • scroll/↑↓ navigate • Esc quit"}
          </Text>
          <Text color="gray" dimColor>
            {!readOnly && (
              <Text color="cyan">
                Ln {cursorLine + 1}, Col {cursorCol + 1}
                <Text color="gray" dimColor> • </Text>
              </Text>
            )}
            {totalLines > viewportHeight
              ? `${scrollOffset + 1}-${Math.min(scrollOffset + viewportHeight, totalLines)} of ${totalLines}`
              : `${totalLines} lines`}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
