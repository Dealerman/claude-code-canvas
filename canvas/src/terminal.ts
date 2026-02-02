import { spawn, spawnSync } from "child_process";

export interface TerminalEnvironment {
  inTmux: boolean;
  inITerm2: boolean;
  inAppleTerminal: boolean;
  inKitty: boolean;
  inWezTerm: boolean;
  inAlacritty: boolean;
  inVSCode: boolean;
  inGhostty: boolean;
  terminalType:
    | "tmux"
    | "iterm2"
    | "apple-terminal"
    | "kitty"
    | "wezterm"
    | "alacritty"
    | "vscode"
    | "ghostty"
    | "none";
  summary: string;
}

export function detectTerminal(): TerminalEnvironment {
  const inTmux = !!process.env.TMUX;
  const inITerm2 =
    process.env.TERM_PROGRAM === "iTerm.app" || !!process.env.ITERM_SESSION_ID;
  const inAppleTerminal = process.env.TERM_PROGRAM === "Apple_Terminal";
  const inKitty =
    process.env.TERM_PROGRAM === "kitty" || !!process.env.KITTY_PID;
  const inWezTerm = process.env.TERM_PROGRAM === "WezTerm";
  const inAlacritty =
    process.env.TERM_PROGRAM === "Alacritty" || !!process.env.ALACRITTY_SOCKET;
  const inVSCode =
    process.env.TERM_PROGRAM === "vscode" || !!process.env.VSCODE_INJECTION;
  const inGhostty =
    process.env.TERM_PROGRAM === "ghostty" || !!process.env.GHOSTTY_RESOURCES_DIR;

  let terminalType: TerminalEnvironment["terminalType"] = "none";
  let summary = "unsupported terminal";

  if (inTmux) {
    terminalType = "tmux";
    summary = "tmux";
  } else if (inITerm2) {
    terminalType = "iterm2";
    summary = "iTerm2";
  } else if (inKitty) {
    terminalType = "kitty";
    summary = "Kitty";
  } else if (inWezTerm) {
    terminalType = "wezterm";
    summary = "WezTerm";
  } else if (inAlacritty) {
    terminalType = "alacritty";
    summary = "Alacritty (new window mode)";
  } else if (inVSCode) {
    terminalType = "vscode";
    summary = "VS Code (new terminal)";
  } else if (inGhostty) {
    terminalType = "ghostty";
    summary = "Ghostty (new window mode)";
  } else if (inAppleTerminal) {
    terminalType = "apple-terminal";
    summary = "Apple Terminal (new window mode)";
  }

  return {
    inTmux,
    inITerm2,
    inAppleTerminal,
    inKitty,
    inWezTerm,
    inAlacritty,
    inVSCode,
    inGhostty,
    terminalType,
    summary,
  };
}

export interface SpawnResult {
  method: string;
  pid?: number;
}

export interface SpawnOptions {
  socketPath?: string;
  scenario?: string;
}

export async function spawnCanvas(
  kind: string,
  id: string,
  configJson?: string,
  options?: SpawnOptions,
): Promise<SpawnResult> {
  const env = detectTerminal();

  // Get the directory of this script (skill directory)
  const scriptDir = import.meta.dir.replace("/src", "");
  const runScript = `${scriptDir}/run-canvas.sh`;

  // Auto-generate socket path for IPC if not provided
  const socketPath = options?.socketPath || `/tmp/canvas-${id}.sock`;

  // Build the command to run
  let command = `${runScript} show ${kind} --id ${id}`;
  if (configJson) {
    // Write config to a temp file to avoid shell escaping issues
    const configFile = `/tmp/canvas-config-${id}.json`;
    await Bun.write(configFile, configJson);
    command += ` --config "$(cat ${configFile})"`;
  }
  command += ` --socket ${socketPath}`;
  if (options?.scenario) {
    command += ` --scenario ${options.scenario}`;
  }

  // Try terminals in priority order
  if (env.inITerm2) {
    const result = await spawnITerm2(command);
    if (result) return { method: "iterm2" };
  }

  if (env.inTmux) {
    const result = await spawnTmux(command);
    if (result) return { method: "tmux" };
  }

  if (env.inKitty) {
    const result = await spawnKitty(command);
    if (result) return { method: "kitty" };
  }

  if (env.inWezTerm) {
    const result = await spawnWezTerm(command);
    if (result) return { method: "wezterm" };
  }

  if (env.inAlacritty) {
    const result = await spawnAlacritty(command);
    if (result) return { method: "alacritty" };
  }

  if (env.inVSCode) {
    const result = await spawnVSCode(command);
    if (result) return { method: "vscode" };
  }

  if (env.inGhostty) {
    const result = await spawnGhostty(command);
    if (result) return { method: "ghostty" };
  }

  if (env.inAppleTerminal) {
    const result = await spawnAppleTerminal(command);
    if (result) return { method: "apple-terminal" };
  }

  throw new Error(
    "Canvas requires a supported terminal: iTerm2, tmux, Kitty, WezTerm, Alacritty, VS Code, Ghostty, or Apple Terminal.",
  );
}

// ============================================================================
// tmux Support
// ============================================================================

const CANVAS_PANE_FILE = "/tmp/claude-canvas-pane-id";

async function getCanvasPaneId(): Promise<string | null> {
  try {
    const file = Bun.file(CANVAS_PANE_FILE);
    if (await file.exists()) {
      const paneId = (await file.text()).trim();
      const result = spawnSync("tmux", [
        "display-message",
        "-t",
        paneId,
        "-p",
        "#{pane_id}",
      ]);
      const output = result.stdout?.toString().trim();
      if (result.status === 0 && output === paneId) {
        return paneId;
      }
      await Bun.write(CANVAS_PANE_FILE, "");
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveCanvasPaneId(paneId: string): Promise<void> {
  await Bun.write(CANVAS_PANE_FILE, paneId);
}

async function createNewPane(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const args = [
      "split-window",
      "-h",
      "-p",
      "67",
      "-P",
      "-F",
      "#{pane_id}",
      command,
    ];
    const proc = spawn("tmux", args);
    let paneId = "";
    proc.stdout?.on("data", (data) => {
      paneId += data.toString();
    });
    proc.on("close", async (code) => {
      if (code === 0 && paneId.trim()) {
        await saveCanvasPaneId(paneId.trim());
      }
      resolve(code === 0);
    });
    proc.on("error", () => resolve(false));
  });
}

async function reuseExistingPane(
  paneId: string,
  command: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const killProc = spawn("tmux", ["send-keys", "-t", paneId, "C-c"]);
    killProc.on("close", () => {
      setTimeout(() => {
        const args = [
          "send-keys",
          "-t",
          paneId,
          `clear && ${command}`,
          "Enter",
        ];
        const proc = spawn("tmux", args);
        proc.on("close", (code) => resolve(code === 0));
        proc.on("error", () => resolve(false));
      }, 150);
    });
    killProc.on("error", () => resolve(false));
  });
}

async function spawnTmux(command: string): Promise<boolean> {
  const existingPaneId = await getCanvasPaneId();

  if (existingPaneId) {
    const reused = await reuseExistingPane(existingPaneId, command);
    if (reused) {
      return true;
    }
    await Bun.write(CANVAS_PANE_FILE, "");
  }

  return createNewPane(command);
}

// ============================================================================
// iTerm2 Support
// ============================================================================

const ITERM2_SESSION_FILE = "/tmp/claude-canvas-iterm2-session";

async function getITerm2SessionId(): Promise<string | null> {
  try {
    const file = Bun.file(ITERM2_SESSION_FILE);
    if (await file.exists()) {
      const sessionId = (await file.text()).trim();
      if (sessionId) {
        const checkScript = `
          tell application "iTerm2"
            repeat with w in windows
              repeat with t in tabs of w
                repeat with s in sessions of t
                  if unique ID of s is "${sessionId}" then
                    return "exists"
                  end if
                end repeat
              end repeat
            end repeat
            return "not_found"
          end tell
        `;
        const result = spawnSync("osascript", ["-e", checkScript]);
        if (
          result.status === 0 &&
          result.stdout?.toString().trim() === "exists"
        ) {
          return sessionId;
        }
        await Bun.write(ITERM2_SESSION_FILE, "");
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveITerm2SessionId(sessionId: string): Promise<void> {
  await Bun.write(ITERM2_SESSION_FILE, sessionId);
}

async function createITerm2SplitPane(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const script = `
      tell application "iTerm2"
        tell current session of current tab of current window
          set newSession to split vertically with same profile
          tell newSession
            write text "${command.replace(/"/g, '\\"')}"
          end tell
          return unique ID of newSession
        end tell
      end tell
    `;

    const proc = spawn("osascript", ["-e", script]);
    let sessionId = "";

    proc.stdout?.on("data", (data) => {
      sessionId += data.toString();
    });

    proc.on("close", async (code) => {
      if (code === 0 && sessionId.trim()) {
        await saveITerm2SessionId(sessionId.trim());
        resolve(true);
      } else {
        resolve(false);
      }
    });

    proc.on("error", () => resolve(false));
  });
}

async function reuseITerm2Session(
  sessionId: string,
  command: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const script = `
      tell application "iTerm2"
        repeat with w in windows
          repeat with t in tabs of w
            repeat with s in sessions of t
              if unique ID of s is "${sessionId}" then
                tell s
                  write text (ASCII character 3)
                  delay 0.15
                  write text "clear && ${command.replace(/"/g, '\\"')}"
                end tell
                return "success"
              end if
            end repeat
          end repeat
        end repeat
        return "not_found"
      end tell
    `;

    const proc = spawn("osascript", ["-e", script]);
    let output = "";

    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      resolve(code === 0 && output.trim() === "success");
    });

    proc.on("error", () => resolve(false));
  });
}

async function spawnITerm2(command: string): Promise<boolean> {
  const existingSessionId = await getITerm2SessionId();

  if (existingSessionId) {
    const reused = await reuseITerm2Session(existingSessionId, command);
    if (reused) {
      return true;
    }
    await Bun.write(ITERM2_SESSION_FILE, "");
  }

  return createITerm2SplitPane(command);
}

// ============================================================================
// Apple Terminal Support (new window, no split panes)
// ============================================================================

const APPLE_TERMINAL_WINDOW_FILE = "/tmp/claude-canvas-terminal-window";

async function getAppleTerminalWindowId(): Promise<number | null> {
  try {
    const file = Bun.file(APPLE_TERMINAL_WINDOW_FILE);
    if (await file.exists()) {
      const windowId = parseInt((await file.text()).trim(), 10);
      if (!isNaN(windowId)) {
        const checkScript = `
          tell application "Terminal"
            repeat with w in windows
              if id of w is ${windowId} then
                return "exists"
              end if
            end repeat
            return "not_found"
          end tell
        `;
        const result = spawnSync("osascript", ["-e", checkScript]);
        if (
          result.status === 0 &&
          result.stdout?.toString().trim() === "exists"
        ) {
          return windowId;
        }
        await Bun.write(APPLE_TERMINAL_WINDOW_FILE, "");
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveAppleTerminalWindowId(windowId: number): Promise<void> {
  await Bun.write(APPLE_TERMINAL_WINDOW_FILE, String(windowId));
}

async function createAppleTerminalWindow(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const script = `
      tell application "Terminal"
        do script "${command.replace(/"/g, '\\"')}"
        set canvasWindow to front window
        set windowId to id of canvasWindow
        tell application "Finder"
          set screenBounds to bounds of window of desktop
          set screenWidth to item 3 of screenBounds
          set screenHeight to item 4 of screenBounds
        end tell
        set bounds of canvasWindow to {(screenWidth / 2), 0, screenWidth, screenHeight}
        set custom title of canvasWindow to "Canvas"
        return windowId
      end tell
    `;

    const proc = spawn("osascript", ["-e", script]);
    let windowId = "";

    proc.stdout?.on("data", (data) => {
      windowId += data.toString();
    });

    proc.on("close", async (code) => {
      const id = parseInt(windowId.trim(), 10);
      if (code === 0 && !isNaN(id)) {
        await saveAppleTerminalWindowId(id);
        resolve(true);
      } else {
        resolve(false);
      }
    });

    proc.on("error", () => resolve(false));
  });
}

async function reuseAppleTerminalWindow(
  windowId: number,
  command: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const script = `
      tell application "Terminal"
        repeat with w in windows
          if id of w is ${windowId} then
            set frontmost of w to true
            do script "clear && ${command.replace(/"/g, '\\"')}" in w
            return "success"
          end if
        end repeat
        return "not_found"
      end tell
    `;

    const proc = spawn("osascript", ["-e", script]);
    let output = "";

    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      resolve(code === 0 && output.trim() === "success");
    });

    proc.on("error", () => resolve(false));
  });
}

async function spawnAppleTerminal(command: string): Promise<boolean> {
  const existingWindowId = await getAppleTerminalWindowId();

  if (existingWindowId) {
    const reused = await reuseAppleTerminalWindow(existingWindowId, command);
    if (reused) {
      return true;
    }
    await Bun.write(APPLE_TERMINAL_WINDOW_FILE, "");
  }

  return createAppleTerminalWindow(command);
}

// ============================================================================
// WezTerm Support
// ============================================================================

const WEZTERM_PANE_FILE = "/tmp/claude-canvas-wezterm-pane";

async function getWezTermPaneId(): Promise<string | null> {
  try {
    const file = Bun.file(WEZTERM_PANE_FILE);
    if (await file.exists()) {
      const paneId = (await file.text()).trim();
      if (paneId) {
        const result = spawnSync("wezterm", ["cli", "list", "--format=json"]);
        if (result.status === 0) {
          try {
            const panes = JSON.parse(result.stdout?.toString() || "[]");
            const exists = panes.some(
              (p: { pane_id: number }) => String(p.pane_id) === paneId,
            );
            if (exists) {
              return paneId;
            }
          } catch {
            // JSON parse error
          }
        }
        await Bun.write(WEZTERM_PANE_FILE, "");
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveWezTermPaneId(paneId: string): Promise<void> {
  await Bun.write(WEZTERM_PANE_FILE, paneId);
}

async function createWezTermSplitPane(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const args = [
      "cli",
      "split-pane",
      "--right",
      "--percent",
      "67",
      "--",
      "bash",
      "-c",
      command,
    ];

    const proc = spawn("wezterm", args);
    let output = "";

    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", async (code) => {
      if (code === 0) {
        const paneId = output.trim();
        if (paneId) {
          await saveWezTermPaneId(paneId);
        }
        resolve(true);
      } else {
        resolve(false);
      }
    });

    proc.on("error", () => resolve(false));
  });
}

async function reuseWezTermPane(
  paneId: string,
  command: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const ctrlC = spawn("wezterm", [
      "cli",
      "send-text",
      "--pane-id",
      paneId,
      "--no-paste",
      "\x03",
    ]);

    ctrlC.on("close", () => {
      setTimeout(() => {
        const newCommand = `clear && ${command}\n`;
        const sendProc = spawn("wezterm", [
          "cli",
          "send-text",
          "--pane-id",
          paneId,
          "--no-paste",
          newCommand,
        ]);

        sendProc.on("close", (code) => resolve(code === 0));
        sendProc.on("error", () => resolve(false));
      }, 150);
    });

    ctrlC.on("error", () => resolve(false));
  });
}

async function spawnWezTerm(command: string): Promise<boolean> {
  const existingPaneId = await getWezTermPaneId();

  if (existingPaneId) {
    const reused = await reuseWezTermPane(existingPaneId, command);
    if (reused) {
      return true;
    }
    await Bun.write(WEZTERM_PANE_FILE, "");
  }

  return createWezTermSplitPane(command);
}

// ============================================================================
// Kitty Support
// ============================================================================

const KITTY_WINDOW_FILE = "/tmp/claude-canvas-kitty-window";

async function getKittyWindowId(): Promise<string | null> {
  try {
    const file = Bun.file(KITTY_WINDOW_FILE);
    if (await file.exists()) {
      const windowId = (await file.text()).trim();
      if (windowId) {
        const result = spawnSync("kitty", ["@", "ls"]);
        if (result.status === 0) {
          try {
            const windows = JSON.parse(result.stdout?.toString() || "[]");
            for (const osWindow of windows) {
              for (const tab of osWindow.tabs || []) {
                for (const win of tab.windows || []) {
                  if (String(win.id) === windowId) {
                    return windowId;
                  }
                }
              }
            }
          } catch {
            // JSON parse error
          }
        }
        await Bun.write(KITTY_WINDOW_FILE, "");
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveKittyWindowId(windowId: string): Promise<void> {
  await Bun.write(KITTY_WINDOW_FILE, windowId);
}

function isKittyRemoteControlAvailable(): boolean {
  const result = spawnSync("kitty", ["@", "ls"], { timeout: 2000 });
  return result.status === 0;
}

async function createKittySplitPane(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (isKittyRemoteControlAvailable()) {
      const args = [
        "@",
        "launch",
        "--location=vsplit",
        "--cwd=current",
        "--title=Canvas",
        "bash",
        "-c",
        command,
      ];

      const proc = spawn("kitty", args);
      let output = "";

      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });

      proc.on("close", async (code) => {
        if (code === 0) {
          const windowId = output.trim();
          if (windowId) {
            await saveKittyWindowId(windowId);
          }
          resolve(true);
        } else {
          resolve(false);
        }
      });

      proc.on("error", () => resolve(false));
    } else {
      const proc = spawn("kitty", ["--title=Canvas", "bash", "-c", command], {
        detached: true,
        stdio: "ignore",
      });

      proc.unref();
      resolve(true);
    }
  });
}

async function reuseKittyWindow(
  windowId: string,
  command: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const ctrlC = spawn("kitty", [
      "@",
      "send-text",
      "--match",
      `id:${windowId}`,
      "\x03",
    ]);

    ctrlC.on("close", () => {
      setTimeout(() => {
        const newCommand = `clear && ${command}\n`;
        const sendProc = spawn("kitty", [
          "@",
          "send-text",
          "--match",
          `id:${windowId}`,
          newCommand,
        ]);

        sendProc.on("close", (code) => resolve(code === 0));
        sendProc.on("error", () => resolve(false));
      }, 150);
    });

    ctrlC.on("error", () => resolve(false));
  });
}

async function spawnKitty(command: string): Promise<boolean> {
  if (isKittyRemoteControlAvailable()) {
    const existingWindowId = await getKittyWindowId();

    if (existingWindowId) {
      const reused = await reuseKittyWindow(existingWindowId, command);
      if (reused) {
        return true;
      }
      await Bun.write(KITTY_WINDOW_FILE, "");
    }
  }

  return createKittySplitPane(command);
}

// ============================================================================
// Alacritty Support (new window, no split panes or remote control)
// ============================================================================

const ALACRITTY_PID_FILE = "/tmp/claude-canvas-alacritty-pid";

async function getAlacrittyPid(): Promise<number | null> {
  try {
    const file = Bun.file(ALACRITTY_PID_FILE);
    if (await file.exists()) {
      const pid = parseInt((await file.text()).trim(), 10);
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 0);
          return pid;
        } catch {
          // Process doesn't exist
        }
        await Bun.write(ALACRITTY_PID_FILE, "");
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveAlacrittyPid(pid: number): Promise<void> {
  await Bun.write(ALACRITTY_PID_FILE, String(pid));
}

async function createAlacrittyWindow(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(
      "alacritty",
      ["--title", "Canvas", "-e", "/bin/sh", "-c", command],
      {
        detached: true,
        stdio: "ignore",
      },
    );

    if (proc.pid) {
      saveAlacrittyPid(proc.pid);

      if (process.platform === "darwin") {
        setTimeout(() => {
          const positionScript = `
            tell application "System Events"
              tell process "Alacritty"
                set frontmost to true
                tell application "Finder"
                  set screenBounds to bounds of window of desktop
                  set screenWidth to item 3 of screenBounds
                  set screenHeight to item 4 of screenBounds
                end tell
                try
                  set position of front window to {(screenWidth / 2), 0}
                  set size of front window to {(screenWidth / 2), screenHeight}
                end try
              end tell
            end tell
          `;
          spawn("osascript", ["-e", positionScript], {
            detached: true,
            stdio: "ignore",
          });
        }, 500);
      }

      proc.unref();
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

async function spawnAlacritty(command: string): Promise<boolean> {
  const existingPid = await getAlacrittyPid();

  if (existingPid) {
    try {
      process.kill(existingPid, "SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch {
      // Process may already be dead
    }
    await Bun.write(ALACRITTY_PID_FILE, "");
  }

  return createAlacrittyWindow(command);
}

// ============================================================================
// VS Code Support (detached process, no split API)
// ============================================================================

const VSCODE_PID_FILE = "/tmp/claude-canvas-vscode-pid";

async function getVSCodePid(): Promise<number | null> {
  try {
    const file = Bun.file(VSCODE_PID_FILE);
    if (await file.exists()) {
      const pid = parseInt((await file.text()).trim(), 10);
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 0);
          return pid;
        } catch {
          // Process doesn't exist
        }
        await Bun.write(VSCODE_PID_FILE, "");
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveVSCodePid(pid: number): Promise<void> {
  await Bun.write(VSCODE_PID_FILE, String(pid));
}

async function createVSCodeTerminal(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("bash", ["-c", command], {
      detached: true,
      stdio: "ignore",
    });

    if (proc.pid) {
      saveVSCodePid(proc.pid);
      proc.unref();

      console.error(
        "\x1b[33m[Canvas] Started in new process. Use VS Code's split terminal (Cmd/Ctrl+Shift+5) to view side-by-side.\x1b[0m",
      );
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

async function spawnVSCode(command: string): Promise<boolean> {
  const existingPid = await getVSCodePid();

  if (existingPid) {
    try {
      process.kill(existingPid, "SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch {
      // Process may already be dead
    }
    await Bun.write(VSCODE_PID_FILE, "");
  }

  return createVSCodeTerminal(command);
}

// ============================================================================
// Ghostty Support (new window, no CLI remote control API)
// ============================================================================

const GHOSTTY_PID_FILE = "/tmp/claude-canvas-ghostty-pid";

async function getGhosttyPid(): Promise<number | null> {
  try {
    const file = Bun.file(GHOSTTY_PID_FILE);
    if (await file.exists()) {
      const pid = parseInt((await file.text()).trim(), 10);
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 0);
          return pid;
        } catch {
          // Process doesn't exist
        }
        await Bun.write(GHOSTTY_PID_FILE, "");
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveGhosttyPid(pid: number): Promise<void> {
  await Bun.write(GHOSTTY_PID_FILE, String(pid));
}

async function createGhosttyWindow(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    let proc;

    if (process.platform === "darwin") {
      // On macOS, ghostty CLI can't launch the terminal directly.
      // Use `open -na Ghostty.app` with -e argument passed via --args.
      proc = spawn(
        "open",
        ["-na", "Ghostty.app", "--args", "-e", "/bin/sh", "-c", command],
        {
          detached: true,
          stdio: "ignore",
        },
      );
    } else {
      proc = spawn(
        "ghostty",
        ["-e", "/bin/sh", "-c", command],
        {
          detached: true,
          stdio: "ignore",
        },
      );
    }

    if (proc.pid) {
      // On macOS, the PID from `open` isn't the Ghostty process itself,
      // so we find the actual Ghostty window PID after a delay
      if (process.platform === "darwin") {
        setTimeout(async () => {
          // Find the newest Ghostty process
          const result = spawnSync("pgrep", ["-n", "ghostty"]);
          const pid = parseInt(result.stdout?.toString().trim(), 10);
          if (!isNaN(pid)) {
            await saveGhosttyPid(pid);
          }

          // Position window on right half of screen
          const positionScript = `
            tell application "System Events"
              tell process "ghostty"
                set frontmost to true
                tell application "Finder"
                  set screenBounds to bounds of window of desktop
                  set screenWidth to item 3 of screenBounds
                  set screenHeight to item 4 of screenBounds
                end tell
                try
                  set position of front window to {(screenWidth / 2), 0}
                  set size of front window to {(screenWidth / 2), screenHeight}
                end try
              end tell
            end tell
          `;
          spawn("osascript", ["-e", positionScript], {
            detached: true,
            stdio: "ignore",
          });
        }, 1000);
      } else {
        saveGhosttyPid(proc.pid);
      }

      proc.unref();
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

async function spawnGhostty(command: string): Promise<boolean> {
  const existingPid = await getGhosttyPid();

  if (existingPid) {
    try {
      process.kill(existingPid, "SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch {
      // Process may already be dead
    }
    await Bun.write(GHOSTTY_PID_FILE, "");
  }

  return createGhosttyWindow(command);
}
