// OpenRouter provider — handles API communication
// OpenRouter provides a unified API for multiple AI models

import {
  AgentRequest,
  AgentResponse,
  ContentBlock,
  Message,
  ToolDefinition,
} from '../types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | OpenRouterContentBlock[] | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
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

/** Convert our messages to OpenRouter (OpenAI-compatible) format */
function convertMessages(
  messages: Message[],
  systemPrompt: string,
): OpenRouterMessage[] {
  const result: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      const textBlocks: OpenRouterContentBlock[] = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          textBlocks.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_result') {
          // OpenAI format: role "tool" with tool_call_id
          result.push({
            role: 'tool',
            content: block.content,
            tool_call_id: block.tool_use_id,
          });
          continue;
        }
      }
      if (textBlocks.length > 0) {
        result.push({
          role: 'user',
          content:
            textBlocks.length === 1 && textBlocks[0].type === 'text'
              ? (textBlocks[0].text as string)
              : textBlocks,
        });
      }
    } else if (msg.role === 'assistant') {
      const hasToolCalls = msg.content.some((b) => b.type === 'tool_use');
      if (hasToolCalls) {
        const textContent = msg.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text)
          .join('');
        const toolCalls = msg.content
          .filter((b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } => b.type === 'tool_use')
          .map((b) => ({
            id: b.id,
            type: 'function' as const,
            function: {
              name: b.name,
              arguments: JSON.stringify(b.input),
            },
          }));

        // Always send a string content (never null) — required by Cohere and other non-Anthropic models
        result.push({
          role: 'assistant',
          content: textContent || '',
          tool_calls: toolCalls,
        });
      } else {
        const text = msg.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text)
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
  const convertedMessages = convertMessages(messages, systemPrompt);

  console.log('[OpenRouter] Request:', {
    model,
    messageCount: convertedMessages.length,
    toolCount: tools.length,
    maxTokens,
  });
  console.log('[OpenRouter] Messages:', JSON.stringify(convertedMessages, null, 2));

  const body = {
    model,
    messages: convertedMessages,
    tools: convertTools(tools),
    max_tokens: maxTokens,
  };

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/toprakpt1/vibeshell',
      'X-Title': 'VibeSHell',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OpenRouter] Error:', response.status, errorText);
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data: OpenRouterResponse = await response.json();

  console.log('[OpenRouter] Response:', {
    id: data.id,
    model: data.model,
    choiceCount: data.choices.length,
    finishReason: data.choices[0]?.finish_reason,
    hasContent: !!data.choices[0]?.message.content,
    toolCallCount: data.choices[0]?.message.tool_calls?.length ?? 0,
  });

  return convertResponse(data);
}
