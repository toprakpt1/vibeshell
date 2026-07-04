// OpenRouter provider — handles API communication
// OpenRouter provides a unified API for multiple AI models

import {
  AgentRequest,
  AgentResponse,
  ContentBlock,
  Message,
  ToolDefinition,
} from './types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenRouterContentBlock[];
}

interface OpenRouterContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenRouterChoice {
  message: {
    role: string;
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
  finish_reason: string;
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

/** Convert our tool definitions to OpenRouter format */
function convertTools(tools: ToolDefinition[]): OpenRouterTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

/** Convert our messages to OpenRouter format */
function convertMessages(
  messages: Message[],
  systemPrompt: string,
): OpenRouterMessage[] {
  const result: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      const contentBlocks: OpenRouterContentBlock[] = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          contentBlocks.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_result') {
          // Tool results go as separate messages in OpenRouter format
          result.push({
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: block.tool_use_id,
                content: block.content,
                is_error: block.is_error,
              },
            ],
          });
          continue;
        }
      }
      if (contentBlocks.length > 0) {
        result.push({
          role: 'user',
          content:
            contentBlocks.length === 1 && contentBlocks[0].type === 'text'
              ? (contentBlocks[0].text as string)
              : contentBlocks,
        });
      }
    } else if (msg.role === 'assistant') {
      const hasToolCalls = msg.content.some((b) => b.type === 'tool_use');
      if (hasToolCalls) {
        const textContent = msg.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('');
        const toolCalls = msg.content
          .filter((b) => b.type === 'tool_use')
          .map((b) => {
            const toolUse = b as {
              type: 'tool_use';
              id: string;
              name: string;
              input: Record<string, unknown>;
            };
            return {
              id: toolUse.id,
              type: 'function' as const,
              function: {
                name: toolUse.name,
                arguments: JSON.stringify(toolUse.input),
              },
            };
          });

        result.push({
          role: 'assistant',
          content: textContent || (null as unknown as string),
          ...({ tool_calls: toolCalls } as Record<string, unknown>),
        } as unknown as OpenRouterMessage);
      } else {
        const text = msg.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('');
        result.push({ role: 'assistant', content: text });
      }
    }
  }

  return result;
}

/** Convert OpenRouter response to our format */
function convertResponse(response: OpenRouterResponse): AgentResponse {
  const choice = response.choices[0];
  const content: ContentBlock[] = [];

  if (choice.message.content) {
    content.push({ type: 'text', text: choice.message.content });
  }

  if (choice.message.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(tc.function.arguments);
      } catch {
        input = { raw: tc.function.arguments };
      }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input,
      });
    }
  }

  let stopReason: 'end_turn' | 'tool_use' | 'max_tokens' = 'end_turn';
  if (choice.finish_reason === 'tool_calls') {
    stopReason = 'tool_use';
  } else if (choice.finish_reason === 'length') {
    stopReason = 'max_tokens';
  }

  return {
    id: response.id,
    model: response.model,
    stop_reason: stopReason,
    content,
    usage: {
      input_tokens: response.usage.prompt_tokens,
      output_tokens: response.usage.completion_tokens,
    },
  };
}

/** Send a request to OpenRouter API */
export async function sendRequest(
  apiKey: string,
  model: string,
  systemPrompt: string,
  tools: ToolDefinition[],
  messages: Message[],
  maxTokens: number = 4096,
): Promise<AgentResponse> {
  const body = {
    model,
    messages: convertMessages(messages, systemPrompt),
    tools: convertTools(tools),
    max_tokens: maxTokens,
  };

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/vibeshell/vibeshell',
      'X-Title': 'VibeSHell',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data: OpenRouterResponse = await response.json();
  return convertResponse(data);
}
