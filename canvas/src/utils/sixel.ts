/**
 * Sixel Graphics Utility
 *
 * Converts images to sixel format for terminal display.
 * Uses img2sixel (libsixel) with chafa as fallback.
 */

import { spawn, spawnSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface SixelOptions {
  width?: number;       // Max width in pixels
  height?: number;      // Max height in pixels
  colors?: number;      // Number of colors (default: 256)
}

export interface ConvertResult {
  sixel: string;        // Sixel escape sequence
  method: "img2sixel" | "chafa" | "blocks";
}

/**
 * Check if a command exists
 */
function commandExists(cmd: string): boolean {
  const result = spawnSync("which", [cmd]);
  return result.status === 0;
}

/**
 * Check if terminal supports sixel
 */
export function supportsSixel(): boolean {
  // Check TERM and TERM_PROGRAM for known sixel-capable terminals
  const term = process.env.TERM || "";
  const termProgram = process.env.TERM_PROGRAM || "";

  // Known sixel-capable terminals
  const sixelTerms = ["xterm-256color", "mlterm", "foot"];
  const sixelPrograms = ["iTerm.app", "foot", "mlterm", "WezTerm"];

  return (
    sixelTerms.some((t) => term.includes(t)) ||
    sixelPrograms.some((p) => termProgram.includes(p)) ||
    process.env.SIXEL_SUPPORT === "1"
  );
}

/**
 * Convert base64 PNG to sixel using img2sixel
 */
async function convertWithImg2sixel(
  base64: string,
  options: SixelOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args: string[] = [];

    if (options.width) {
      args.push("-w", String(options.width));
    }
    if (options.height) {
      args.push("-h", String(options.height));
    }

    const proc = spawn("img2sixel", args);
    let output = "";
    let error = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr.on("data", (data) => {
      error += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`img2sixel failed: ${error}`));
      }
    });

    // Write base64 decoded data to stdin
    const buffer = Buffer.from(base64, "base64");
    proc.stdin.write(buffer);
    proc.stdin.end();
  });
}

/**
 * Convert base64 PNG to sixel using chafa
 */
async function convertWithChafa(
  base64: string,
  options: SixelOptions
): Promise<string> {
  // chafa needs a file, so write to temp
  const tempPath = join(tmpdir(), `imagine-${Date.now()}.png`);

  try {
    const buffer = Buffer.from(base64, "base64");
    writeFileSync(tempPath, buffer);

    return new Promise((resolve, reject) => {
      const args = ["--format=sixel"];

      if (options.width) {
        args.push(`--size=${options.width}x${options.height || options.width}`);
      }

      args.push(tempPath);

      const proc = spawn("chafa", args);
      let output = "";
      let error = "";

      proc.stdout.on("data", (data) => {
        output += data.toString();
      });

      proc.stderr.on("data", (data) => {
        error += data.toString();
      });

      proc.on("close", (code) => {
        // Clean up temp file
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }

        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`chafa failed: ${error}`));
        }
      });
    });
  } catch (err) {
    // Clean up on error
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
    throw err;
  }
}

/**
 * Convert base64 PNG to block characters (fallback)
 */
async function convertToBlocks(
  base64: string,
  options: SixelOptions
): Promise<string> {
  // chafa can also output block characters
  const tempPath = join(tmpdir(), `imagine-${Date.now()}.png`);

  try {
    const buffer = Buffer.from(base64, "base64");
    writeFileSync(tempPath, buffer);

    return new Promise((resolve, reject) => {
      const args = ["--format=symbols", "--symbols=block"];

      if (options.width) {
        // For blocks, width is in characters
        const charWidth = Math.floor(options.width / 8);
        args.push(`--size=${charWidth}`);
      }

      args.push(tempPath);

      const proc = spawn("chafa", args);
      let output = "";
      let error = "";

      proc.stdout.on("data", (data) => {
        output += data.toString();
      });

      proc.stderr.on("data", (data) => {
        error += data.toString();
      });

      proc.on("close", (code) => {
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }

        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`chafa blocks failed: ${error}`));
        }
      });
    });
  } catch (err) {
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
    throw err;
  }
}

/**
 * Convert base64 PNG to terminal graphics
 *
 * Tries img2sixel first, then chafa sixel, then block characters
 */
export async function toTerminalGraphics(
  base64: string,
  options: SixelOptions = {}
): Promise<ConvertResult> {
  // Try img2sixel first (best quality)
  if (commandExists("img2sixel") && supportsSixel()) {
    try {
      const sixel = await convertWithImg2sixel(base64, options);
      return { sixel, method: "img2sixel" };
    } catch {
      // Fall through to chafa
    }
  }

  // Try chafa sixel
  if (commandExists("chafa") && supportsSixel()) {
    try {
      const sixel = await convertWithChafa(base64, options);
      return { sixel, method: "chafa" };
    } catch {
      // Fall through to blocks
    }
  }

  // Fall back to block characters
  if (commandExists("chafa")) {
    const sixel = await convertToBlocks(base64, options);
    return { sixel, method: "blocks" };
  }

  throw new Error("No image conversion tool available. Install libsixel or chafa.");
}

/**
 * Print sixel directly to stdout
 */
export function printSixel(sixel: string): void {
  process.stdout.write(sixel);
}
