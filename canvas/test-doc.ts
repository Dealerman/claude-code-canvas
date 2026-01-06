import { renderCanvas } from "./src/canvases/index";

const content = `# The Future of AI Assistants

Artificial intelligence has come a long way in recent years. From simple chatbots to sophisticated **language models**, the progress has been remarkable.

## Key Developments

- Natural language understanding
- Code generation capabilities
- Multi-modal processing
- Real-time collaboration

### Code Example

\`\`\`typescript
const assistant = new AIAssistant({
  model: "claude-opus-4",
  capabilities: ["code", "analysis", "creativity"]
});

await assistant.help("Build something amazing");
\`\`\`

> "The best way to predict the future is to invent it."
> — Alan Kay

## What's Next?

The integration of AI into everyday tools continues to accelerate. [Learn more](https://anthropic.com)

---

*This is a demonstration of the document canvas with markdown rendering.*`;

const config = {
  content,
  title: "AI Assistants - Draft",
  diffs: [],  // Test without diffs first
};

renderCanvas("document", "test-1", config, { scenario: "edit" });
