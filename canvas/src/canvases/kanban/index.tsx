// Kanban Canvas - Main router component

import React from "react";
import type { KanbanConfig } from "./types";
import { DisplayView } from "./scenarios/display-view";
import { EditView } from "./scenarios/edit-view";

export type { KanbanConfig, KanbanMoveResult, KanbanTask, KanbanColumn } from "./types";

interface KanbanProps {
  id: string;
  config?: KanbanConfig;
  socketPath?: string;
  scenario?: string;
}

export function Kanban({ id, config, socketPath, scenario = "display" }: KanbanProps) {
  const resolvedConfig: KanbanConfig = config || { tasks: [] };

  switch (scenario) {
    case "edit":
      return (
        <EditView
          id={id}
          config={resolvedConfig}
          socketPath={socketPath}
        />
      );
    case "display":
    default:
      return (
        <DisplayView
          id={id}
          config={resolvedConfig}
          socketPath={socketPath}
        />
      );
  }
}
