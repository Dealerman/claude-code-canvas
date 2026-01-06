// Kanban Card Component - renders a single task card with box-drawing borders

import React from "react";
import { Box, Text } from "ink";
import type { KanbanTask } from "../types";
import { BORDERS } from "../types";

interface CardProps {
  task: KanbanTask;
  width: number;
  isCursor?: boolean;
  isSelected?: boolean;
  isHovered?: boolean;
}

export function Card({
  task,
  width,
  isCursor = false,
  isSelected = false,
  isHovered = false,
}: CardProps) {
  // Pick border style based on state
  const border = isSelected
    ? BORDERS.selected
    : isCursor
      ? BORDERS.cursor
      : BORDERS.normal;

  // Pick colors based on state
  const borderColor = isSelected
    ? "yellow"
    : isCursor
      ? "cyan"
      : isHovered
        ? "white"
        : "gray";

  const textColor = isSelected ? "yellow" : isCursor ? "cyan" : "white";

  // Calculate inner width (minus 2 for borders)
  const innerWidth = Math.max(1, width - 2);

  // Truncate text if needed
  const displayText =
    task.content.length > innerWidth
      ? task.content.slice(0, innerWidth - 3) + "..."
      : task.content.padEnd(innerWidth);

  // Build the card with 3 lines: top border, content, bottom border
  const topBorder =
    border.topLeft + border.horizontal.repeat(innerWidth) + border.topRight;
  const bottomBorder =
    border.bottomLeft +
    border.horizontal.repeat(innerWidth) +
    border.bottomRight;

  return (
    <Box flexDirection="column">
      <Box key="top">
        <Text color={borderColor}>{topBorder}</Text>
      </Box>
      <Box key="content">
        <Text color={borderColor}>{border.vertical}</Text>
        <Text color={textColor} bold={isCursor || isSelected}>
          {displayText}
        </Text>
        <Text color={borderColor}>{border.vertical}</Text>
      </Box>
      <Box key="bottom">
        <Text color={borderColor}>{bottomBorder}</Text>
      </Box>
    </Box>
  );
}

// Empty slot placeholder (for drop targets)
interface EmptySlotProps {
  width: number;
  isTarget?: boolean;
}

export function EmptySlot({ width, isTarget = false }: EmptySlotProps) {
  const innerWidth = Math.max(1, width - 2);
  const border = isTarget ? BORDERS.cursor : BORDERS.normal;
  const borderColor = isTarget ? "cyan" : "gray";

  const topBorder =
    border.topLeft + border.horizontal.repeat(innerWidth) + border.topRight;
  const bottomBorder =
    border.bottomLeft +
    border.horizontal.repeat(innerWidth) +
    border.bottomRight;
  const emptyText = isTarget
    ? "Drop here".padStart(Math.floor((innerWidth + 9) / 2)).padEnd(innerWidth)
    : " ".repeat(innerWidth);

  return (
    <Box flexDirection="column">
      <Box key="top">
        <Text color={borderColor} dimColor={!isTarget}>
          {topBorder}
        </Text>
      </Box>
      <Box key="content">
        <Text color={borderColor} dimColor={!isTarget}>
          {border.vertical}
        </Text>
        <Text color={isTarget ? "cyan" : "gray"} dimColor={!isTarget}>
          {emptyText}
        </Text>
        <Text color={borderColor} dimColor={!isTarget}>
          {border.vertical}
        </Text>
      </Box>
      <Box key="bottom">
        <Text color={borderColor} dimColor={!isTarget}>
          {bottomBorder}
        </Text>
      </Box>
    </Box>
  );
}
