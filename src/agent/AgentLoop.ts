// Agent Loop — Core engine that drives the AI conversation
// Handles the cycle: user prompt → AI response → tool execution → repeat

import * as bridge from '../bridge/commands';
import { sendRequest } from './providers/openrouter';
import { TOOL_DEFINITIONS } from './tools';
import { Message, ContentBlock, ToolUseBlock, ToolResultBlock } from './types';

const MAX_ITERATIONS = 25; // Safety limit to prevent infinite loops

interface AgentLoopCallbacks {
  onAssistantText: (text: string) => void;
  onToolCall: (id: string, name: string, input: Record<string, unknown>) => void;
  onToolResult: (id: string, result: string, isError: boolean) => void;
  onComplete: () => void;
  onError: (error: string) => void;
  onUsage: (input: number, output: number) => void;
}

/** Execute a single tool call via bridge */
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  workspacePath: string,
): Promise<{ result: string; isError: boolean }> {
  try {
    switch (name) {
      case 'run_command': {
        const cwd = (input.cwd as string) || workspacePath;
        const result = await bridge.exec(input.command as string, cwd);
        const output = result.stdout || '';
        const stderr = result.stderr || '';
        const combined = stderr
          ? `${output}\n[stderr]: ${stderr}\n[exit code]: ${result.exitCode}`
          : `${output}\n[exit code]: ${result.exitCode}`;
        return { result: combined, isError: result.exitCode !== 0 };
      }

      case 'read_file': {
        const content = await bridge.readFile(input.path as string);
        return { result: content, isError: false };
      }

      case 'write_file': {
        await bridge.writeFile(input.path as string, input.content as string);
        return { result: `File written: ${input.path}`, isError: false };
      }

      case 'list_dir': {
        const entries = await bridge.listDir(input.path as string);
        const formatted = entries
          .map((e) => `${e.type === 'directory' ? '📁' : '📄'} ${e.name}${e.size ? ` (${e.size}b)` : ''}`)
          .join('\n');
        return { result: formatted || '(empty directory)', isError: false };
      }

      case 'apply_patch': {
        // Apply patch via shell command
        const result = await bridge.exec(
          `echo ${JSON.stringify(input.diff)} | patch ${JSON.stringify(input.path)}`,
          workspacePath,
        );
        return {
          result: result.exitCode === 0 ? `Patch applied to ${input.path}` : `Patch failed: ${result.stderr}`,
          isError: result.exitCode !== 0,
        };
      }

      case 'git_diff': {
        const cwd = (input.cwd as string) || workspacePath;
        const diff = await bridge.gitDiff(cwd);
        return { result: diff || '(no changes)', isError: false };
      }

      case 'git_commit': {
        const cwd = (input.cwd as string) || workspacePath;
        const result = await bridge.gitCommit(cwd, input.message as string);
        return { result, isError: false };
      }

      default:
        return { result: `Unknown tool: ${name}`, isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: `Error: ${message}`, isError: true };
  }
}

/** Run the agent loop */
export async function runAgentLoop(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Message[],
  workspacePath: string,
  callbacks: AgentLoopCallbacks,
  signal?: AbortSignal,
): Promise<Message[]> {
  const conversationMessages = [...messages];
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    if (signal?.aborted) {
      callbacks.onError('Agent loop cancelled');
      break;
    }

    iterations++;

    try {
      // Send request to AI
      const response = await sendRequest(
        apiKey,
        model,
        systemPrompt,
        TOOL_DEFINITIONS,
        conversationMessages,
      );

      callbacks.onUsage(response.usage.input_tokens, response.usage.output_tokens);

      // Process assistant's response
      const assistantContent: ContentBlock[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          assistantContent.push(block);
          callbacks.onAssistantText(block.text);
        } else if (block.type === 'tool_use') {
          assistantContent.push(block);
          callbacks.onToolCall(block.id, block.name, block.input);
        }
      }

      // Add assistant message to conversation
      conversationMessages.push({
        role: 'assistant',
        content: assistantContent,
      });

      // If no tool calls, we're done
      if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
        callbacks.onComplete();
        break;
      }

      // Execute tool calls
      const toolResults: ContentBlock[] = [];
      const toolUseBlocks = assistantContent.filter(
        (b): b is ToolUseBlock => b.type === 'tool_use',
      );

      for (const toolCall of toolUseBlocks) {
        if (signal?.aborted) break;

        const { result, isError } = await executeTool(
          toolCall.name,
          toolCall.input,
          workspacePath,
        );

        callbacks.onToolResult(toolCall.id, result, isError);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: result,
          is_error: isError,
        } as ToolResultBlock);
      }

      // Add tool results as user message
      conversationMessages.push({
        role: 'user',
        content: toolResults,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      callbacks.onError(message);
      break;
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    callbacks.onError('Maximum iterations reached');
  }

  return conversationMessages;
}
