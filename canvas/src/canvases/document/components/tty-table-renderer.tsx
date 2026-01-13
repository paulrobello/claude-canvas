// TTY-Table Markdown Renderer - Uses tty-table for proper table rendering with word wrap
// Combined with marked-terminal for non-table markdown formatting

import React, { useMemo, useEffect } from "react";
import { Box, Text } from "ink";
import { Marked, Tokens } from "marked";
import { markedTerminal } from "marked-terminal";
import Table from "tty-table";

interface Props {
  content: string;
  terminalWidth?: number;
  scrollOffset?: number;
  viewportHeight?: number;
  onLineCountChange?: (lineCount: number) => void;
}

// Render a markdown table using tty-table
function renderTable(token: Tokens.Table, width: number): string {
  // Extract header values
  const headerRow = token.header.map((cell) => cell.text);

  // Extract body rows
  const bodyRows = token.rows.map((row) =>
    row.map((cell) => cell.text)
  );

  // Calculate column widths proportionally
  const numCols = headerRow.length;
  // Reserve space for borders and padding
  // tty-table adds: left margin (2) + borders (numCols+1) + padding (numCols*2)
  const borderOverhead = 2 + numCols + 1 + numCols * 2;
  const availableWidth = Math.max(20, width - borderOverhead);
  const colWidth = Math.floor(availableWidth / numCols);

  // Build header config for tty-table
  const header = headerRow.map((text, idx) => ({
    value: `col${idx}`,
    alias: text,
    width: colWidth,
    align: "left" as const,
    headerAlign: "left" as const,
    color: "white",
    headerColor: "red",
  }));

  // Convert body rows to objects
  const rows = bodyRows.map((row) => {
    const obj: Record<string, string> = {};
    row.forEach((cell, idx) => {
      obj[`col${idx}`] = cell;
    });
    return obj;
  });

  // Create and render table
  const table = Table(header, rows, {
    borderStyle: "solid",
    borderColor: "gray",
    compact: false,
  });

  // Add newline after table for spacing
  return table.render() + "\n";
}

// Utility function to render markdown with tty-table for tables
export function renderMarkdownWithTtyTable(content: string, width: number): string {
  const markedInstance = new Marked();

  // First, use marked-terminal for base formatting
  markedInstance.use(
    markedTerminal({
      width: width,
      reflowText: true,
      showSectionPrefix: false,
      tab: 2,
    })
  );

  // Override table renderer to use tty-table
  markedInstance.use({
    renderer: {
      table(token: Tokens.Table): string {
        return renderTable(token, width);
      },
    },
  });

  try {
    const result = markedInstance.parse(content);
    if (typeof result !== "string") return content;
    return result;
  } catch (e) {
    console.error("Markdown parse error:", e);
    return content;
  }
}

export function TtyTableRenderer({
  content,
  terminalWidth = 80,
  scrollOffset = 0,
  viewportHeight,
  onLineCountChange,
}: Props) {
  // Render markdown with tty-table
  const renderedContent = useMemo(() => {
    return renderMarkdownWithTtyTable(content, terminalWidth);
  }, [content, terminalWidth]);

  // Split into lines for viewport scrolling
  const lines = useMemo(() => {
    return renderedContent.split("\n");
  }, [renderedContent]);

  // Report line count to parent
  useEffect(() => {
    if (onLineCountChange) {
      onLineCountChange(lines.length);
    }
  }, [lines.length, onLineCountChange]);

  // Apply viewport
  const visibleLines = viewportHeight
    ? lines.slice(scrollOffset, scrollOffset + viewportHeight)
    : lines;

  return (
    <Box flexDirection="column">
      {visibleLines.map((line, idx) => (
        <Text key={scrollOffset + idx}>{line || " "}</Text>
      ))}
    </Box>
  );
}
