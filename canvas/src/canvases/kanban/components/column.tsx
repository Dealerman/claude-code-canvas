// Kanban Column Component - renders column header and list of cards

import React from "react";
import { Box, Text } from "ink";
import type { KanbanColumn, KanbanTask } from "../types";
import { getTextColor } from "../types";
import { Card, EmptySlot } from "./card";

interface ColumnProps {
  column: KanbanColumn;
  tasks: KanbanTask[];
  width: number;
  height: number;
  cursorIndex?: number; // -1 or undefined = no cursor in this column
  selectedTaskId?: string | null;
  isTargetColumn?: boolean; // True when dragging and this column is hovered
  interactive?: boolean; // Enable cursor/selection display
}

export function Column({
  column,
  tasks,
  width,
  height,
  cursorIndex,
  selectedTaskId,
  isTargetColumn = false,
  interactive = false,
}: ColumnProps) {
  const cardWidth = width - 2; // Padding inside column
  const headerHeight = 3; // Title + count + separator
  const availableHeight = Math.max(0, height - headerHeight);

  // Calculate how many cards we can show (each card is 3 lines + 1 margin)
  const cardHeight = 4;
  const maxVisibleCards = Math.floor(availableHeight / cardHeight);

  // Determine scroll offset to keep cursor visible
  let scrollOffset = 0;
  if (
    interactive &&
    cursorIndex !== undefined &&
    cursorIndex >= 0 &&
    tasks.length > maxVisibleCards
  ) {
    // Keep cursor centered-ish
    scrollOffset = Math.max(
      0,
      Math.min(
        cursorIndex - Math.floor(maxVisibleCards / 2),
        tasks.length - maxVisibleCards
      )
    );
  }

  const visibleTasks = tasks.slice(
    scrollOffset,
    scrollOffset + maxVisibleCards
  );
  const hasMore = tasks.length > scrollOffset + maxVisibleCards;
  const hasLess = scrollOffset > 0;

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Column header */}
      <Box
        justifyContent="center"
        paddingX={1}
        backgroundColor={column.color}
        width={width}
      >
        <Text color={getTextColor(column.color)} bold>
          {column.title}
        </Text>
      </Box>

      {/* Task count */}
      <Box justifyContent="center" width={width}>
        <Text color="gray" dimColor>
          ({tasks.length})
        </Text>
      </Box>

      {/* Scroll indicator (up) */}
      {hasLess && (
        <Box justifyContent="center" width={width}>
          <Text color="gray">{"▲ " + scrollOffset + " more"}</Text>
        </Box>
      )}

      {/* Cards */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visibleTasks.length === 0 ? (
          <EmptySlot width={cardWidth} isTarget={isTargetColumn} />
        ) : (
          visibleTasks.map((task, i) => {
            const actualIndex = scrollOffset + i;
            const isCursor =
              interactive &&
              cursorIndex !== undefined &&
              actualIndex === cursorIndex;
            const isSelected = selectedTaskId === task.id;

            return (
              <Box key={task.id} marginBottom={1}>
                <Card
                  task={task}
                  width={cardWidth}
                  isCursor={isCursor}
                  isSelected={isSelected}
                />
              </Box>
            );
          })
        )}

        {/* Drop target indicator when column is empty and being targeted */}
        {visibleTasks.length > 0 && isTargetColumn && (
          <EmptySlot width={cardWidth} isTarget />
        )}
      </Box>

      {/* Scroll indicator (down) */}
      {hasMore && (
        <Box justifyContent="center" width={width}>
          <Text color="gray">
            {"▼ " + (tasks.length - scrollOffset - maxVisibleCards) + " more"}
          </Text>
        </Box>
      )}
    </Box>
  );
}
