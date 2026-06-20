/**
 * Anthropic provider — the paid FALLBACK (spec §5), default model
 * `claude-haiku-4-5` (cheapest current model, sufficient once dates are computed
 * in code and grounding does the factual work). Selectable as an override too.
 *
 * Uses the official @anthropic-ai/sdk. Web-search grounding is the server-side
 * web_search tool; because Haiku is not in the Opus 4.6+/Sonnet 4.6 family, we
 * use the basic `web_search_20250305` variant (the dynamic-filtering _20260209
 * variant needs a newer model). The big system prompt is marked cacheable with
 * `cache_control` for ~90% cheaper repeated input (spec §7 phase 2).
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  GenerationRequest,
  GenerationResult,
  ModelProvider,
  ProviderId,
} from "../types";
import { FreeTierLimitError } from "../types";

export const FALLBACK_ANTHROPIC_MODEL = "claude-haiku-4-5";

export class AnthropicProvider implements ModelProvider {
  readonly id: ProviderId = "anthropic";
  readonly model: string;
  private readonly client: Anthropic;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.client = new Anthropic({ apiKey });
  }

  async generate(req: GenerationRequest): Promise<GenerationResult> {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: req.userPrompt },
    ];

    let text = "";
    // Server-side web search can pause the turn (pause_turn) when it hits its
    // internal iteration cap; re-send to resume. Keep the loop small — the
    // hosting function has a short timeout (spec §7 phase 2).
    for (let i = 0; i < 4; i++) {
      let message: Anthropic.Message;
      try {
        // Stream internally so a large max_tokens can't hit the SDK HTTP timeout.
        const stream = this.client.messages.stream({
          model: this.model,
          max_tokens: 16000,
          system: [
            {
              type: "text",
              text: req.systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages,
        });
        message = await stream.finalMessage();
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) {
          throw new FreeTierLimitError("Anthropic rate limit reached");
        }
        throw err;
      }

      text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      if (message.stop_reason === "pause_turn") {
        // Append the assistant turn (incl. the server_tool_use blocks) and resume.
        messages.push({
          role: "assistant",
          content: message.content as unknown as Anthropic.ContentBlockParam[],
        });
        continue;
      }
      break;
    }

    return { text, provider: this.id, model: this.model };
  }
}
