// Tool definitions for the agent loop
// These are sent to the AI model to describe available capabilities

import { ToolDefinition } from './types';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'run_command',
    description:
      'Execute a shell command in the terminal. Use this for running scripts, installing packages, building projects, running tests, etc. The command runs in the specified working directory.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        cwd: {
          type: 'string',
          description:
            'Working directory for the command. Defaults to the workspace root.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description:
      'Read the contents of a file at the specified path. Use this to understand existing code before making changes.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the file to read',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Write content to a file at the specified path. Creates parent directories if they don\'t exist. Use this to create new files or completely replace file contents.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the file to write',
        },
        content: {
          type: 'string',
          description: 'The full content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_dir',
    description:
      'List the contents of a directory. Returns file names, types (file/directory), and sizes. Use this to explore project structure.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the directory to list',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'apply_patch',
    description:
      'Apply a unified diff patch to modify a file. More efficient than rewriting entire files. Use standard unified diff format.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the file to patch',
        },
        diff: {
          type: 'string',
          description: 'Unified diff content to apply',
        },
      },
      required: ['path', 'diff'],
    },
  },
  {
    name: 'git_diff',
    description:
      'Show the git diff of uncommitted changes in the working directory.',
    input_schema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: 'Working directory of the git repository',
        },
      },
      required: ['cwd'],
    },
  },
  {
    name: 'git_commit',
    description:
      'Stage all changes and create a git commit with the specified message.',
    input_schema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: 'Working directory of the git repository',
        },
        message: {
          type: 'string',
          description: 'Commit message',
        },
      },
      required: ['cwd', 'message'],
    },
  },
];

// Emoji icons for tool call display
export const TOOL_ICONS: Record<string, string> = {
  run_command: '⚙️',
  read_file: '📄',
  write_file: '✏️',
  list_dir: '📁',
  apply_patch: '🩹',
  git_diff: '📊',
  git_commit: '💾',
};

// Human-readable labels
export const TOOL_LABELS: Record<string, string> = {
  run_command: 'Komut çalıştırılıyor',
  read_file: 'Dosya okunuyor',
  write_file: 'Dosya yazılıyor',
  list_dir: 'Dizin listeleniyor',
  apply_patch: 'Patch uygulanıyor',
  git_diff: 'Git diff alınıyor',
  git_commit: 'Git commit yapılıyor',
};
