// Kanban Board Types

// Task item matching TodoWrite structure
export interface KanbanTask {
  id: string;
  content: string; // Imperative form ("Fix login bug")
  activeForm: string; // Present continuous ("Fixing login bug")
  status: "pending" | "in_progress" | "completed";
}

// Column configuration
export interface KanbanColumn {
  id: string;
  title: string;
  color: string; // Ink color: "gray" | "blue" | "green" | "cyan" | "magenta" | "yellow" | "red"
  statusFilter: string[]; // Which statuses appear in this column
}

// Board configuration (passed via --config)
export interface KanbanConfig {
  title?: string;
  tasks: KanbanTask[];
  columns?: KanbanColumn[]; // Custom columns (optional, defaults to DEFAULT_COLUMNS)
}

// Result sent back via IPC when user moves a card
export interface KanbanMoveResult {
  taskId: string;
  fromColumn: string;
  toColumn: string;
  newStatus: string;
}

// Cursor position in the board
export interface BoardCursor {
  columnIndex: number; // Which column (0-based)
  cardIndex: number; // Which card within column (0-based, -1 for empty)
}

// Default column configuration (maps to TodoWrite statuses)
export const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "To Do", color: "gray", statusFilter: ["pending"] },
  {
    id: "doing",
    title: "In Progress",
    color: "blue",
    statusFilter: ["in_progress"],
  },
  { id: "done", title: "Done", color: "green", statusFilter: ["completed"] },
];

// Box-drawing characters for card borders
export const BORDERS = {
  // Normal card
  normal: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
  },
  // Cursor highlight (double line)
  cursor: {
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    vertical: "║",
  },
  // Selected for moving (thick line)
  selected: {
    topLeft: "┏",
    topRight: "┓",
    bottomLeft: "┗",
    bottomRight: "┛",
    horizontal: "━",
    vertical: "┃",
  },
} as const;

// Column separator characters
export const COLUMN_BORDERS = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  topTee: "┬",
  bottomTee: "┴",
  leftTee: "├",
  rightTee: "┤",
  cross: "┼",
} as const;

// Text colors for contrast on colored backgrounds
export const TEXT_COLORS: Record<string, string> = {
  gray: "white",
  blue: "white",
  green: "black",
  cyan: "black",
  magenta: "white",
  yellow: "black",
  red: "white",
  white: "black",
};

// Get contrasting text color for a background
export function getTextColor(bgColor: string): string {
  return TEXT_COLORS[bgColor] || "white";
}
