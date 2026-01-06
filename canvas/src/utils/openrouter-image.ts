/**
 * OpenRouter Image Generation Utility
 *
 * Generates images using OpenRouter's image generation models (Flux, Gemini).
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

// Load .env from agent root if not already set
if (!process.env.OPENROUTER_API_KEY) {
  // Try multiple paths to find the .env
  const possiblePaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "../.env"),
    join(process.cwd(), "../../.env"),
    join(process.cwd(), "../../../.env"),
  ];

  for (const envPath of possiblePaths) {
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        if (line.startsWith("OPENROUTER_API_KEY=")) {
          process.env.OPENROUTER_API_KEY = line.split("=")[1].trim();
          break;
        }
      }
      if (process.env.OPENROUTER_API_KEY) break;
    }
  }
}

const CACHE_DIR = join(process.cwd(), "tmp", "imagine-cache");

export type ImageModel = "flux-pro" | "flux-flex" | "gemini";
export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9";

const MODEL_MAP: Record<ImageModel, string> = {
  "flux-pro": "google/gemini-3-pro-image-preview",  // Best quality
  "flux-flex": "google/gemini-2.5-flash-image",     // Fast, GA version
  "gemini": "google/gemini-2.5-flash-image",        // Default
};

export interface GenerateImageOptions {
  prompt: string;
  model?: ImageModel;
  aspectRatio?: AspectRatio;
  useCache?: boolean;
}

export interface GenerateImageResult {
  base64: string;      // Base64 PNG data (without data URL prefix)
  dataUrl: string;     // Full data URL
  cached: boolean;     // Whether this was served from cache
  prompt: string;      // The prompt used
}

/**
 * Get cache key for a prompt
 */
function getCacheKey(prompt: string, model: ImageModel): string {
  const hash = createHash("sha256")
    .update(`${model}:${prompt}`)
    .digest("hex")
    .slice(0, 16);
  return hash;
}

/**
 * Get cached image if it exists
 */
function getCached(key: string): string | null {
  const cachePath = join(CACHE_DIR, `${key}.png.b64`);
  if (existsSync(cachePath)) {
    return readFileSync(cachePath, "utf-8");
  }
  return null;
}

/**
 * Save image to cache
 */
function saveToCache(key: string, base64: string): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
  const cachePath = join(CACHE_DIR, `${key}.png.b64`);
  writeFileSync(cachePath, base64);
}

/**
 * Generate an image using OpenRouter
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  const {
    prompt,
    model = "gemini",
    aspectRatio = "16:9",
    useCache = true,
  } = options;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set in environment");
  }

  // Check cache first
  const cacheKey = getCacheKey(prompt, model);
  if (useCache) {
    const cached = getCached(cacheKey);
    if (cached) {
      return {
        base64: cached,
        dataUrl: `data:image/png;base64,${cached}`,
        cached: true,
        prompt,
      };
    }
  }

  // Build request body
  const modelId = MODEL_MAP[model];
  const body: Record<string, unknown> = {
    model: modelId,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  // Add modalities for image generation
  if (model === "gemini") {
    body.modalities = ["image", "text"];
  }

  // Make API request
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/anthropics/claude-code",
      "X-Title": "Claude Canvas Imagine",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract image from response
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("No message in response");
  }

  // Handle different response formats
  let base64: string;

  if (message.images && message.images.length > 0) {
    // Gemini format: images array with image_url
    const imageUrl = message.images[0].image_url?.url || message.images[0].url;
    if (imageUrl?.startsWith("data:image")) {
      base64 = imageUrl.split(",")[1];
    } else {
      throw new Error("Unexpected image URL format");
    }
  } else if (message.content && typeof message.content === "string") {
    // Some models return base64 in content
    if (message.content.startsWith("data:image")) {
      base64 = message.content.split(",")[1];
    } else {
      throw new Error(`No image in response. Content: ${message.content.slice(0, 100)}`);
    }
  } else {
    throw new Error("No image found in response");
  }

  // Cache the result
  if (useCache) {
    saveToCache(cacheKey, base64);
  }

  return {
    base64,
    dataUrl: `data:image/png;base64,${base64}`,
    cached: false,
    prompt,
  };
}

/**
 * Clear the image cache
 */
export function clearCache(): void {
  if (existsSync(CACHE_DIR)) {
    const files = require("fs").readdirSync(CACHE_DIR);
    for (const file of files) {
      require("fs").unlinkSync(join(CACHE_DIR, file));
    }
  }
}
