// Edit View - Interactive kanban board with card movement

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import type { KanbanConfig, KanbanMoveResult } from "../types";
import { Column } from "../components/column";
import { useKanbanState } from "../hooks/use-kanban-state";
import { useIPC } from "../../calendar/hooks/use-ipc";

interface Props {
  id: string;
  config: KanbanConfig;
  socketPath?: string;
}

type Mode = "navigate" | "moving" | "countdown" | "confirmed";

export function EditView({ id, config, socketPath }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });
  const [mode, setMode] = useState<Mode>("navigate");
  const [countdown, setCountdown] = useState<number>(0);
  const [pendingMove, setPendingMove] = useState<KanbanMoveResult | null>(null);
  const [spinnerFrame, setSpinnerFrame] = useState(0);

  const spinnerChars = ["|", "/", "-", "\\"];

  const {
    columns,
    getColumnTasks,
    cursor,
    taskAtCursor,
    moveCursorUp,
    moveCursorDown,
    moveCursorLeft,
    moveCursorRight,
    selectedTaskId,
    selectTaskAtCursor,
    deselectTask,
    moveSelectedToCursor,
    selectedTaskColumn,
  } = useKanbanState({
    tasks: config.tasks || [],
    columns: config.columns,
  });

  // IPC for communicating with Claude
  const ipc = useIPC({
    socketPath,
    scenario: "edit",
    onClose: () => exit(),
  });

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

  // Countdown timer
  useEffect(() => {
    if (mode !== "countdown") return;

    if (countdown <= 0) {
      // Countdown finished, confirm move
      setMode("confirmed");
      setTimeout(() => exit(), 1000);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [mode, countdown, exit]);

  // Spinner animation
  useEffect(() => {
    if (mode !== "countdown" && mode !== "moving") return;
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % spinnerChars.length);
    }, 100);
    return () => clearInterval(interval);
  }, [mode, spinnerChars.length]);

  // Start move with countdown
  const startMove = useCallback(
    (skipCountdown: boolean) => {
      const move = moveSelectedToCursor();
      if (!move) {
        // No valid move (same column or no selection)
        deselectTask();
        setMode("navigate");
        return;
      }

      setPendingMove(move);
      ipc.sendSelected(move);

      if (skipCountdown) {
        setMode("confirmed");
        setTimeout(() => exit(), 500);
      } else {
        setCountdown(3);
        setMode("countdown");
      }
    },
    [moveSelectedToCursor, deselectTask, ipc, exit]
  );

  // Cancel move
  const cancelMove = useCallback(() => {
    setPendingMove(null);
    deselectTask();
    setMode("navigate");
  }, [deselectTask]);

  // Keyboard controls
  useInput((input, key) => {
    // Quit
    if (input === "q" && mode === "navigate") {
      ipc.sendCancelled("User pressed q");
      exit();
      return;
    }

    // Escape handling depends on mode
    if (key.escape) {
      if (mode === "countdown") {
        cancelMove();
      } else if (mode === "moving") {
        deselectTask();
        setMode("navigate");
      } else {
        ipc.sendCancelled("User pressed escape");
        exit();
      }
      return;
    }

    // Navigation (only in navigate mode)
    if (mode === "navigate") {
      if (key.upArrow || input === "k") {
        moveCursorUp();
      } else if (key.downArrow || input === "j") {
        moveCursorDown();
      } else if (key.leftArrow || input === "h") {
        moveCursorLeft();
      } else if (key.rightArrow || input === "l") {
        moveCursorRight();
      } else if (key.return || input === " ") {
        // Select card at cursor
        if (taskAtCursor) {
          selectTaskAtCursor();
          setMode("moving");
        }
      }
      return;
    }

    // Moving mode - arrow keys move card between columns
    if (mode === "moving") {
      if (key.leftArrow || input === "h") {
        moveCursorLeft();
      } else if (key.rightArrow || input === "l") {
        moveCursorRight();
      } else if (key.return || input === " ") {
        // Confirm move
        startMove(key.shift || false);
      }
      return;
    }
  });

  const termWidth = dimensions.width;
  const termHeight = dimensions.height;

  // Calculate column widths
  const headerHeight = 4; // Title + mode + blank + help
  const availableHeight = Math.max(10, termHeight - headerHeight);
  const columnWidth = Math.max(18, Math.floor((termWidth - 2) / columns.length));

  // Status text based on mode
  const getStatusText = () => {
    switch (mode) {
      case "navigate":
        if (taskAtCursor) {
          return `Cursor: "${taskAtCursor.content}"`;
        }
        return "Navigate with arrow keys";
      case "moving":
        const task = config.tasks?.find((t) => t.id === selectedTaskId);
        return `Moving: "${task?.content}" - ←→ to choose column, Enter to confirm`;
      case "countdown":
        return `${spinnerChars[spinnerFrame]} Moving in ${countdown}... (Esc to cancel)`;
      case "confirmed":
        return "* Move confirmed!";
      default:
        return "";
    }
  };

  return (
    <Box
      flexDirection="column"
      width={termWidth}
      height={termHeight}
      paddingX={1}
    >
      {/* Title bar */}
      <Box>
        <Text bold color="white">
          {config.title || "Kanban Board"}
        </Text>
        <Text color="gray"> - </Text>
        <Text color="cyan" bold>
          {mode === "navigate"
            ? "SELECT"
            : mode === "moving"
              ? "MOVE"
              : mode === "countdown"
                ? "CONFIRMING"
                : "DONE"}
        </Text>
      </Box>

      {/* Status line */}
      <Box marginBottom={1}>
        <Text
          color={
            mode === "confirmed"
              ? "green"
              : mode === "countdown"
                ? "yellow"
                : mode === "moving"
                  ? "cyan"
                  : "gray"
          }
        >
          {getStatusText()}
        </Text>
      </Box>

      {/* Columns */}
      <Box flexGrow={1}>
        {columns.map((column, colIndex) => {
          const isTargetColumn =
            mode === "moving" &&
            selectedTaskColumn &&
            column.id !== selectedTaskColumn.id &&
            colIndex === cursor.columnIndex;

          return (
            <Column
              key={column.id}
              column={column}
              tasks={getColumnTasks(colIndex)}
              width={columnWidth}
              height={availableHeight}
              cursorIndex={
                cursor.columnIndex === colIndex ? cursor.cardIndex : undefined
              }
              selectedTaskId={selectedTaskId}
              isTargetColumn={isTargetColumn}
              interactive={mode !== "confirmed"}
            />
          );
        })}
      </Box>

      {/* Help bar */}
      <Box>
        {mode === "navigate" && (
          <Text color="gray" dimColor>
            ↑↓←→/hjkl navigate | Enter/Space select | q/Esc quit
          </Text>
        )}
        {mode === "moving" && (
          <Text color="gray" dimColor>
            ←→/hl move to column | Enter confirm | Esc cancel
          </Text>
        )}
        {mode === "countdown" && (
          <Text color="gray" dimColor>
            Esc to cancel
          </Text>
        )}
      </Box>
    </Box>
  );
}
