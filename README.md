# Claude Canvas

A TUI toolkit that gives Claude Code its own display. Spawn interactive terminal interfaces for dashboards, kanban boards, calendars, documents, flight bookings, and much more.

**Note:** This is a proof of concept and is unsupported.

![Claude Canvas Screenshot](media/screenshot.png)

## Features

### 17 Canvas Types

| Category | Canvas | Description |
|----------|--------|-------------|
| **Business** | `kanban` | Task board with columns, cards, drag-drop, WIP limits, labels, priorities |
| | `pipeline` | CRM sales pipeline with stages, deals, probability tracking |
| | `dashboard` | Multi-widget dashboard with stats, charts (bar/line/pie), gauges, tables |
| | `invoice` | Invoice generator with line items, tax calculation, status tracking |
| | `gantt` | Project timeline with tasks, milestones, day/week/month views |
| | `org-chart` | Organization hierarchy with tree navigation, expand/collapse |
| **Travel** | `hotel` | Hotel search with ratings, room selection, amenities, compare mode |
| | `itinerary` | Trip planner with day-by-day activities, drag reorder, cost tracking |
| | `flight` | Flight booking with comparison, seat selection, cyberpunk UI |
| **Personal** | `budget` | Budget tracker with categories, spending visualization, pie charts |
| | `smart-home` | IoT dashboard with room-based device controls, status indicators |
| | `workout` | Exercise tracker with sets/reps, rest timer, progress tracking |
| **Creative** | `playlist` | Music playlist with now playing, drag reorder, shuffle |
| **Development** | `git-diff` | Diff viewer with unified/split modes, file navigation |
| **AI** | `agent-dashboard` | Agent monitoring with status, logs, token usage, context visualization |
| **Calendar** | `calendar` | Calendar display, meeting picker, event CRUD with local storage |
| **Documents** | `document` | Markdown viewer/editor with syntax highlighting, selection support |

### Interactive Features

- **Mouse support**: Click, drag, scroll wheel navigation
- **Keyboard navigation**: Arrow keys, Tab, Enter, Space, ESC
- **IPC communication**: Real-time updates via Unix sockets (TCP on Windows)
- **Terminal Vision**: Claude can capture and "see" canvas output to iterate

### Shared Component Library

Reusable components for building new canvases:

- **Charts**: Bar, Line, Pie, Gauge, Sparkline, Heatmap
- **Forms**: TextInput, Select, Slider, DatePicker
- **Layout**: Panel, Tabs, Modal, Accordion
- **Data**: DataTable with sorting, filtering, pagination

## Requirements

### macOS / Linux
- [Bun](https://bun.sh) - Runtime for canvas tools
- [tmux](https://github.com/tmux/tmux) - Canvases spawn in split panes

### Windows
- [Bun](https://bun.sh) - Runtime for canvas tools
- [Windows Terminal](https://aka.ms/terminal) - Canvases spawn in split panes (recommended)

## Installation

Add this repository as a marketplace in Claude Code:

```bash
/plugin marketplace add dvdsgl/claude-canvas
```

Then install the canvas plugin:

```bash
/plugin install canvas@claude-canvas
```

## Quick Start

```bash
cd canvas

# Show a canvas in current terminal
bun run src/cli.ts show kanban --config '{"columns": [...]}'

# Spawn in new tmux split pane (recommended)
bun run src/cli.ts spawn dashboard --config '{"widgets": [...]}'

# Check terminal environment
bun run src/cli.ts env
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `show [kind]` | Render canvas in current terminal |
| `spawn [kind]` | Spawn canvas in new tmux/WT pane |
| `capture` | Capture canvas pane output (Terminal Vision) |
| `pane-id` | Get current canvas pane ID |
| `update <id>` | Send config update via IPC |
| `selection <id>` | Get selection from document canvas |
| `content <id>` | Get content from document canvas |
| `env` | Show detected terminal environment |

### Common Options

```bash
--id <id>           # Canvas instance ID for IPC
--config <json>     # Inline JSON configuration
--config-file <path> # Load config from JSON file
--scenario <name>   # Interaction mode (display, edit, etc.)
--socket <path>     # Custom IPC socket path
```

## Terminal Vision

Claude can "see" what's rendered in canvas panes and iterate without user screenshots.

```bash
# Capture canvas output
bun run src/cli.ts capture

# With options
bun run src/cli.ts capture --history  # Include scrollback
bun run src/cli.ts capture --escape   # Include ANSI colors
bun run src/cli.ts capture --json     # Structured output
```

**Workflow:**
1. Claude spawns canvas with config
2. Claude captures output to see rendering
3. Claude identifies issues and updates config
4. Repeat until layout is correct

## Canvas Examples

### Kanban Board

```bash
bun run src/cli.ts spawn kanban --config '{
  "columns": [
    {"id": "todo", "title": "To Do", "wipLimit": 5, "cards": [
      {"id": "1", "title": "Task 1", "priority": "high", "labels": ["bug"]}
    ]},
    {"id": "doing", "title": "In Progress", "cards": []},
    {"id": "done", "title": "Done", "cards": []}
  ]
}'
```

### Dashboard

```bash
bun run src/cli.ts spawn dashboard --config '{
  "title": "Sales Dashboard",
  "widgets": [
    {"id": "1", "type": "stat", "title": "Revenue", "data": {"value": 125000, "trend": 12}},
    {"id": "2", "type": "chart-bar", "title": "Monthly Sales", "data": [
      {"label": "Jan", "value": 10000},
      {"label": "Feb", "value": 15000}
    ]},
    {"id": "3", "type": "gauge", "title": "Goal Progress", "data": {"value": 75, "max": 100}}
  ]
}'
```

### Calendar with CRUD

```bash
# Display mode
bun run src/cli.ts spawn calendar --config '{
  "title": "My Calendar",
  "events": [
    {"id": "1", "title": "Team Meeting", "startTime": "2024-01-15T10:00:00", "endTime": "2024-01-15T11:00:00"}
  ]
}'

# Edit mode with persistence
bun run src/cli.ts spawn calendar --scenario edit
```

Calendar edit mode supports:
- **Create**: Press `c` to add new event
- **Edit**: Press `e` to modify selected event
- **Delete**: Press `d` to remove event
- Events persist to `~/.claude/calendar-events.json`

### Flight Booking

```bash
bun run src/cli.ts spawn flight --config-file test-flight.json
```

## Keyboard Shortcuts

Common shortcuts across all canvases:

| Key | Action |
|-----|--------|
| `↑↓` | Navigate items |
| `←→` | Navigate sections/columns |
| `Enter` | Select/confirm |
| `Space` | Toggle/drag |
| `Tab` | Switch focus between panels |
| `ESC` / `q` | Back/cancel/exit |
| `Scroll` | Mouse wheel navigation |

Canvas-specific shortcuts:
- **Calendar**: `←→` week, `t` today, `c` create, `e` edit, `d` delete
- **Kanban**: `Space` drag card, `Enter` move to next column
- **Flight**: `Tab` switch flight list/seatmap focus

## Windows Setup

Windows support uses Windows Terminal for split panes instead of tmux.

### Install Bun

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Install Windows Terminal

Windows Terminal is pre-installed on Windows 11. For Windows 10:

```powershell
winget install Microsoft.WindowsTerminal
```

### How It Works on Windows

- **IPC**: TCP sockets (localhost) instead of Unix domain sockets
- **Spawning**: `wt.exe` CLI creates split panes or new tabs
- **Launcher Scripts**: Temporary `.cmd` files in `%TEMP%` avoid escaping issues

### Manual Testing

```powershell
cd canvas
bun run src/cli.ts env                              # Check terminal detection
bun run src/cli.ts spawn calendar                   # Spawn calendar
bun run src/cli.ts spawn calendar --config-file test-calendar.json
```

## IPC Protocol

Canvases communicate via Unix domain sockets (TCP on Windows).

**Canvas → Controller:**
```typescript
{ type: "ready", scenario }      // Canvas initialized
{ type: "selected", data }       // User made selection
{ type: "cancelled", reason? }   // User cancelled
{ type: "error", message }       // Error occurred
```

**Controller → Canvas:**
```typescript
{ type: "update", config }  // Update configuration
{ type: "close" }           // Request close
{ type: "ping" }            // Health check
```

## Development

```bash
cd canvas
bun install

# Run tests
bun test

# Type check
bun run tsc --noEmit

# Run specific canvas
bun run src/cli.ts show <kind> --config '{...}'
```

## Project Structure

```
canvas/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── terminal.ts         # Terminal detection, spawning, capture
│   ├── canvases/           # Canvas components (React/Ink)
│   │   ├── calendar/       # Calendar with CRUD
│   │   ├── document/       # Markdown editor
│   │   ├── flight/         # Flight booking
│   │   ├── kanban/         # Kanban board
│   │   ├── dashboard/      # Multi-widget dashboard
│   │   └── ...             # 12 more canvas types
│   ├── shared/             # Shared component library
│   │   ├── components/     # Charts, Forms, Layout
│   │   ├── hooks/          # Mouse, navigation, forms
│   │   └── types/          # Common type definitions
│   ├── scenarios/          # Scenario definitions
│   └── ipc/                # IPC server/client
├── skills/                 # Skill documentation
└── test-*.json             # Test configuration files
```

## License

MIT
