import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useStdout } from "ink";
import { generateImage, type ImageModel, type AspectRatio } from "../utils/openrouter-image";
import { toTerminalGraphics, supportsSixel } from "../utils/sixel";

export interface ImagineConfig {
  prompt: string;
  style?: "wireframe" | "artistic" | "blueprint" | "photo" | "chart";
  aspectRatio?: AspectRatio;
  model?: ImageModel;
  width?: number;
  height?: number;
}

interface ImagineProps {
  id: string;
  config?: ImagineConfig;
  socketPath?: string;
  scenario?: string;
}

type Status = "loading" | "generating" | "converting" | "ready" | "error";

// Style-specific prompt prefixes for better results
const STYLE_PREFIXES: Record<string, string> = {
  wireframe: "A clean, minimal wireframe mockup with black lines on white background, no colors, technical drawing style:",
  artistic: "An artistic, creative visualization with vibrant colors and flowing shapes:",
  blueprint: "A technical blueprint diagram, white lines on dark blue background, engineering style:",
  photo: "A photorealistic image:",
  chart: "A clean, professional data visualization chart with clear labels, modern flat design:",
};

export function Imagine({ id, config, socketPath, scenario = "generate" }: ImagineProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const termWidth = stdout?.columns || 120;
  const termHeight = stdout?.rows || 40;

  // Calculate image dimensions based on terminal size
  const imageWidth = config?.width || Math.min(termWidth * 8, 800);
  const imageHeight = config?.height || Math.min((termHeight - 6) * 16, 600);

  useEffect(() => {
    if (!config?.prompt) {
      setStatus("error");
      setError("No prompt provided");
      return;
    }

    async function generate() {
      try {
        setStatus("generating");

        // Build the full prompt with style prefix
        const stylePrefix = config?.style ? STYLE_PREFIXES[config.style] || "" : "";
        const fullPrompt = stylePrefix ? `${stylePrefix} ${config.prompt}` : config.prompt;

        // Generate image
        const result = await generateImage({
          prompt: fullPrompt,
          model: config?.model || "gemini",
          aspectRatio: config?.aspectRatio || "16:9",
          useCache: true,
        });

        setCached(result.cached);
        setStatus("converting");

        // Convert to terminal graphics
        const converted = await toTerminalGraphics(result.base64, {
          width: imageWidth,
          height: imageHeight,
        });

        setImageData(converted.sixel);
        setMethod(converted.method);
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    generate();
  }, [config?.prompt, config?.style, config?.model, config?.aspectRatio, imageWidth, imageHeight]);

  // Handle keyboard input
  useEffect(() => {
    const handleInput = (data: Buffer) => {
      const key = data.toString();
      if (key === "q" || key === "\x1b" || key === "\x03") {
        exit();
      }
    };

    process.stdin.on("data", handleInput);
    return () => {
      process.stdin.off("data", handleInput);
    };
  }, [exit]);

  if (status === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="red">Error</Text>
        </Box>
        <Text color="red">{error}</Text>
        <Box marginTop={1}>
          <Text color="gray">Press q to exit</Text>
        </Box>
      </Box>
    );
  }

  if (status !== "ready" || !imageData) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">Imagine</Text>
          <Text color="gray"> - AI Image Generation</Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="gray">Prompt: </Text>
          <Text color="white">{config?.prompt?.slice(0, 60)}...</Text>
        </Box>

        <Box>
          <Text color="yellow">
            {status === "loading" && "Initializing..."}
            {status === "generating" && "Generating image with AI..."}
            {status === "converting" && "Converting to terminal graphics..."}
          </Text>
          <Text color="gray"> (this may take a few seconds)</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box paddingX={1} marginBottom={1}>
        <Text bold color="cyan">Imagine</Text>
        <Text color="gray"> | </Text>
        <Text color="gray">{method}</Text>
        {cached && <Text color="green"> (cached)</Text>}
        <Text color="gray"> | </Text>
        <Text color="gray">q to exit</Text>
      </Box>

      {/* Image - rendered directly via sixel escape codes */}
      <Box>
        <Text>{imageData}</Text>
      </Box>

      {/* Footer */}
      <Box paddingX={1} marginTop={1}>
        <Text color="gray" dimColor>
          {config?.prompt?.slice(0, termWidth - 4)}
        </Text>
      </Box>
    </Box>
  );
}

export default Imagine;
