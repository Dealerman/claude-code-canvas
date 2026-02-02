# Claude Canvas

A TUI toolkit that gives Claude Code its own display. Spawn interactive terminal interfaces for emails, calendars, flight bookings, and more.

**Note:** This is a proof of concept and is unsupported.

![Claude Canvas Screenshot](media/screenshot.png)

## Requirements

- [Bun](https://bun.sh) — used to run skill tools
- A supported terminal (at least one):
  - **tmux** — split pane (side by side)
  - **iTerm2** — split pane via AppleScript
  - **Kitty** — split pane via remote control (or new window if remote control disabled)
  - **WezTerm** — split pane via CLI
  - **Alacritty** — new window (no remote control)
  - **VS Code** — detached process (use Cmd/Ctrl+Shift+5 for side-by-side)
  - **Ghostty** — new window (no CLI remote control API yet)
  - **Apple Terminal** — new window via AppleScript

## Installation

Add this repository as a marketplace in Claude Code:

```
/plugin marketplace add Dealerman/claude-code-canvas
```

Then install the canvas plugin:

```
/plugin install canvas@claude-code-canvas
```

## License

MIT
