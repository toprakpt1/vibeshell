// Workspace management store
// Manages project list, each linked to a Termux directory

import { create } from 'zustand';

export interface Workspace {
  id: string;
  name: string;
  path: string; // Termux filesystem path, e.g. ~/projects/myapp
  createdAt: number;
  lastOpenedAt: number;
}

interface WorkspacesState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

  // Actions
  addWorkspace: (name: string, path: string) => Workspace;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  updateLastOpened: (id: string) => void;
  getActiveWorkspace: () => Workspace | null;
}

function generateId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useWorkspaces = create<WorkspacesState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,

  addWorkspace: (name: string, path: string) => {
    const workspace: Workspace = {
      id: generateId(),
      name,
      path,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    };
    set((state) => ({
      workspaces: [...state.workspaces, workspace],
      activeWorkspaceId: workspace.id,
    }));
    return workspace;
  },

  removeWorkspace: (id: string) => {
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId:
        state.activeWorkspaceId === id ? null : state.activeWorkspaceId,
    }));
  },

  setActiveWorkspace: (id: string) => {
    set({ activeWorkspaceId: id });
    get().updateLastOpened(id);
  },

  updateLastOpened: (id: string) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, lastOpenedAt: Date.now() } : w,
      ),
    }));
  },

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId) || null;
  },
}));
