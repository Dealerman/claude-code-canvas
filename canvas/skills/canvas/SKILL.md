---
name: canvas
description: |
  **The primary skill for terminal TUI components.** Covers spawning, controlling, and interacting with terminal canvases.
  Use when displaying calendars, documents, flight bookings, kanban boards, or other interactive TUIs.
---

# Canvas TUI Toolkit

**Start here when using terminal canvases.** This skill covers the overall workflow, canvas types, and IPC communication.

## Overview

Canvas provides interactive terminal displays (TUIs) that Claude can spawn and control. Each canvas type supports multiple scenarios for different interaction modes.

## Available Canvas Types

| Canvas | Purpose | Scenarios |
|--------|---------|-----------|
| `calendar` | Display calendars, pick meeting times | `display`, `meeting-picker` |
| `document` | View/edit markdown documents | `display`, `edit`, `email-preview` |
| `flight` | Flight comparison and seat selection | `booking` |

## Quick Start

```bash
cd ${CLAUDE_PLUGIN_ROOT}

# Run canvas in current terminal
bun run src/cli.ts show calendar

# Spawn canvas in new tmux split
bun run src/cli.ts spawn calendar --scenario meeting-picker --config '{...}'
```

## Spawning Canvases

**Always use `spawn` for interactive scenarios** - this opens the canvas in a tmux split pane while keeping the conversation terminal available.

```bash
bun run src/cli.ts spawn [kind] --scenario [name] --config '[json]'
```

**Parameters:**
- `kind`: Canvas type (calendar, document, flight, kanban, imagine)
- `--scenario`: Interaction mode (e.g., display, meeting-picker, edit)
- `--config`: JSON configuration for the canvas
- `--id`: Optional canvas instance ID for IPC

## IPC Communication

Interactive canvases communicate via Unix domain sockets.

**Canvas → Controller:**
```typescript
{ type: "ready", scenario }        // Canvas is ready
{ type: "selected", data }         // User made a selection
{ type: "cancelled", reason? }     // User cancelled
{ type: "error", message }         // Error occurred
```

**Controller → Canvas:**
```typescript
{ type: "update", config }  // Update canvas configuration
{ type: "close" }           // Request canvas to close
{ type: "ping" }            // Health check
```

## High-Level API

For programmatic use, import the API module:

```typescript
import { pickMeetingTime, editDocument, bookFlight } from "${CLAUDE_PLUGIN_ROOT}/src/api";

// Spawn meeting picker and wait for selection
const result = await pickMeetingTime({
  calendars: [...],
  slotGranularity: 30,
});

if (result.success && result.data) {
  console.log(`Selected: ${result.data.startTime}`);
}
```

## Requirements

- **tmux**: Canvas spawning requires a tmux session
- **Terminal with mouse support**: For click-based interactions
- **Bun**: Runtime for executing canvas commands

## Skills Reference

| Skill | Purpose |
|-------|---------|
| `calendar` | Calendar display and meeting picker details |
| `document` | Document rendering and text selection |
| `flight` | Flight comparison and seat map details |
