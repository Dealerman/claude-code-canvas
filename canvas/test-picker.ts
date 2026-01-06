// Test script for meeting picker with IPC
import { createIPCServer } from "./src/ipc/server";
import { getSocketPath } from "./src/ipc/types";
import { spawnCanvas } from "./src/terminal";

const id = `picker-${Date.now()}`;
const socketPath = getSocketPath(id);

console.log("Starting meeting picker test...");
console.log(`Socket: ${socketPath}`);

const server = createIPCServer({
  socketPath,
  onConnect() {
    console.log("Canvas connected!");
  },
  onMessage(msg) {
    console.log("Received:", JSON.stringify(msg, null, 2));
    if (msg.type === "selected" || msg.type === "cancelled") {
      console.log("\nResult received. Closing server...");
      server.close();
      process.exit(0);
    }
  },
  onDisconnect() {
    console.log("Canvas disconnected");
    server.close();
    process.exit(0);
  },
  onError(err) {
    console.error("Error:", err);
  },
});

const config = {
  calendars: [
    {
      name: "David",
      color: "blue",
      events: [
        { id: "1", title: "Standup", startTime: "2026-01-06T09:00:00", endTime: "2026-01-06T09:30:00" },
        { id: "2", title: "Product Review", startTime: "2026-01-06T14:00:00", endTime: "2026-01-06T15:00:00" },
      ],
    },
    {
      name: "Alice",
      color: "magenta",
      events: [
        { id: "3", title: "Team Sync", startTime: "2026-01-06T10:00:00", endTime: "2026-01-06T11:00:00" },
        { id: "4", title: "1:1", startTime: "2026-01-07T15:00:00", endTime: "2026-01-07T16:00:00" },
      ],
    },
  ],
  slotGranularity: 30,
};

console.log("Spawning canvas...");
spawnCanvas("calendar", id, JSON.stringify(config), {
  socketPath,
  scenario: "meeting-picker",
}).then((result) => {
  console.log(`Spawned via ${result.method}`);
  console.log("Waiting for selection... (click a free slot, then press Enter)");
});
