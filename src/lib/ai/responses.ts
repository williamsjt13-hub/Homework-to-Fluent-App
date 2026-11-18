import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, type ModelMessage, type ToolSet } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.ts";

export function createResponsesCall(
  request: Request,
  config: {
    baseURL: string;
    apiKey: string;
    model: string;
    onFailure?: (status: number, message: string) => Promise<void>;
  },
  messages: ModelMessage[],
  instructions?: string,
  options: { tools?: ToolSet } = {},
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  let failure: { status: number; message: string } | undefined;
  const provider = createOpenAICompatible({
    name: "gemini",
    baseURL: config.baseURL.replace(/\/+$/, ""),
    apiKey: config.apiKey,
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      if (!response.ok) {
        const raw = await response.clone().text();
        let message = raw;
        try {
          const body = JSON.parse(raw);
          message = body.error?.message ?? body[0]?.error?.message ?? body.message ?? raw;
        } catch {
          /* plain error */
        }
        failure = { status: response.status, message };
        await config.onFailure?.(response.status, message);
      }
      return response;
    },
  });
  const result = streamText({
    ...options,
    model: provider.chatModel(config.model),
    ...(instructions ? { system: instructions } : {}),
    messages,
    abortSignal: request.signal,
    maxRetries: 0,
  });
  return {
    result,
    gateway: runIdFetch,
    getFailure: () => failure,
    response: () =>
      withLovableAiGatewayRunIdHeader(
        result.toUIMessageStreamResponse({ sendReasoning: true }),
        runIdFetch,
      ),
  };
}
