// Kanban State Management Hook

import { useState, useMemo, useCallback } from "react";
import type {
  KanbanTask,
  KanbanColumn,
  KanbanMoveResult,
  BoardCursor,
} from "../types";
import { DEFAULT_COLUMNS } from "../types";

interface UseKanbanStateOptions {
  tasks: KanbanTask[];
  columns?: KanbanColumn[];
}

export function useKanbanState({ tasks, columns }: UseKanbanStateOptions) {
  const resolvedColumns = columns || DEFAULT_COLUMNS;

  // Group tasks by column
  const columnTasks = useMemo(() => {
    const grouped = new Map<string, KanbanTask[]>();

    // Initialize empty arrays for all columns
    for (const col of resolvedColumns) {
      grouped.set(col.id, []);
    }

    // Assign tasks to columns based on status filter
    for (const task of tasks) {
      for (const col of resolvedColumns) {
        if (col.statusFilter.includes(task.status)) {
          const existing = grouped.get(col.id) || [];
          existing.push(task);
          grouped.set(col.id, existing);
          break; // Task goes to first matching column only
        }
      }
    }

    return grouped;
  }, [tasks, resolvedColumns]);

  // Cursor position
  const [cursor, setCursor] = useState<BoardCursor>({
    columnIndex: 0,
    cardIndex: 0,
  });

  // Selected task ID (for moving)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Get tasks for a column
  const getColumnTasks = useCallback(
    (columnIndex: number): KanbanTask[] => {
      const col = resolvedColumns[columnIndex];
      return col ? columnTasks.get(col.id) || [] : [];
    },
    [resolvedColumns, columnTasks]
  );

  // Get task at cursor position
  const taskAtCursor = useMemo(() => {
    const tasks = getColumnTasks(cursor.columnIndex);
    return tasks[cursor.cardIndex] || null;
  }, [cursor, getColumnTasks]);

  // Navigation helpers
  const moveCursorUp = useCallback(() => {
    setCursor((c) => ({
      ...c,
      cardIndex: Math.max(0, c.cardIndex - 1),
    }));
  }, []);

  const moveCursorDown = useCallback(() => {
    setCursor((c) => {
      const tasks = getColumnTasks(c.columnIndex);
      return {
        ...c,
        cardIndex: Math.min(tasks.length - 1, c.cardIndex + 1),
      };
    });
  }, [getColumnTasks]);

  const moveCursorLeft = useCallback(() => {
    setCursor((c) => {
      const newColIndex = Math.max(0, c.columnIndex - 1);
      const newColTasks = getColumnTasks(newColIndex);
      return {
        columnIndex: newColIndex,
        cardIndex: Math.min(c.cardIndex, Math.max(0, newColTasks.length - 1)),
      };
    });
  }, [getColumnTasks]);

  const moveCursorRight = useCallback(() => {
    setCursor((c) => {
      const newColIndex = Math.min(resolvedColumns.length - 1, c.columnIndex + 1);
      const newColTasks = getColumnTasks(newColIndex);
      return {
        columnIndex: newColIndex,
        cardIndex: Math.min(c.cardIndex, Math.max(0, newColTasks.length - 1)),
      };
    });
  }, [resolvedColumns.length, getColumnTasks]);

  // Selection
  const selectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);

  const deselectTask = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const selectTaskAtCursor = useCallback(() => {
    if (taskAtCursor) {
      setSelectedTaskId(taskAtCursor.id);
    }
  }, [taskAtCursor]);

  // Find which column a task is currently in
  const findTaskColumn = useCallback(
    (taskId: string): KanbanColumn | null => {
      for (const col of resolvedColumns) {
        const tasks = columnTasks.get(col.id) || [];
        if (tasks.some((t) => t.id === taskId)) {
          return col;
        }
      }
      return null;
    },
    [resolvedColumns, columnTasks]
  );

  // Calculate move result (doesn't actually move, just returns what would happen)
  const calculateMove = useCallback(
    (taskId: string, toColumnIndex: number): KanbanMoveResult | null => {
      const fromColumn = findTaskColumn(taskId);
      const toColumn = resolvedColumns[toColumnIndex];

      if (!fromColumn || !toColumn) return null;
      if (fromColumn.id === toColumn.id) return null; // No move needed

      // Determine new status based on target column's filter
      const newStatus = toColumn.statusFilter[0] || "pending";

      return {
        taskId,
        fromColumn: fromColumn.id,
        toColumn: toColumn.id,
        newStatus,
      };
    },
    [findTaskColumn, resolvedColumns]
  );

  // Move selected task to cursor column
  const moveSelectedToCursor = useCallback((): KanbanMoveResult | null => {
    if (!selectedTaskId) return null;
    return calculateMove(selectedTaskId, cursor.columnIndex);
  }, [selectedTaskId, cursor.columnIndex, calculateMove]);

  // Get column containing selected task
  const selectedTaskColumn = useMemo(() => {
    if (!selectedTaskId) return null;
    return findTaskColumn(selectedTaskId);
  }, [selectedTaskId, findTaskColumn]);

  return {
    // Data
    columns: resolvedColumns,
    columnTasks,
    getColumnTasks,

    // Cursor
    cursor,
    setCursor,
    taskAtCursor,

    // Navigation
    moveCursorUp,
    moveCursorDown,
    moveCursorLeft,
    moveCursorRight,

    // Selection
    selectedTaskId,
    selectTask,
    deselectTask,
    selectTaskAtCursor,
    selectedTaskColumn,

    // Movement
    calculateMove,
    moveSelectedToCursor,
  };
}
