// Display View - Read-only kanban board

import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import type { KanbanConfig } from "../types";
import { DEFAULT_COLUMNS } from "../types";
import { Column } from "../components/column";
import { useKanbanState } from "../hooks/use-kanban-state";

interface Props {
  id: string;
  config: KanbanConfig;
  socketPath?: string;
}

export function DisplayView({ config }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });

  const { columns, getColumnTasks } = useKanbanState({
    tasks: config.tasks || [],
    columns: config.columns,
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

  // Keyboard controls
  useInput((input, key) => {
    if (input === "q" || key.escape) {
      exit();
    }
  });

  const termWidth = dimensions.width;
  const termHeight = dimensions.height;

  // Calculate column widths
  const headerHeight = 3; // Title + blank line + help
  const availableHeight = Math.max(10, termHeight - headerHeight);
  const columnWidth = Math.max(18, Math.floor((termWidth - 2) / columns.length));

  return (
    <Box
      flexDirection="column"
      width={termWidth}
      height={termHeight}
      paddingX={1}
    >
      {/* Title bar */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {"▸ "}
        </Text>
        <Text bold color="white">
          {config.title || "Kanban Board"}
        </Text>
        <Text color="gray">{" │ "}</Text>
        <Text color="green" bold>
          {config.tasks?.filter((t) => t.status === "completed").length || 0}
        </Text>
        <Text color="gray">/</Text>
        <Text color="white">
          {config.tasks?.length || 0}
        </Text>
        <Text color="gray" dimColor>
          {" tasks complete"}
        </Text>
      </Box>

      {/* Columns */}
      <Box flexGrow={1}>
        {columns.map((column, i) => (
          <Column
            key={column.id}
            column={column}
            tasks={getColumnTasks(i)}
            width={columnWidth}
            height={availableHeight}
            interactive={false}
          />
        ))}
      </Box>

      {/* Help bar */}
      <Box>
        <Text color="gray" dimColor>
          q/Esc quit
        </Text>
      </Box>
    </Box>
  );
}
