import { create } from "zustand";
import type { Project } from "../../shared/types/project";

/**
 * Creates a clean default Volvelle project structure.
 * Uses native `crypto.randomUUID()` to generate stable identifiers.
 */
export function createEmptyProject(): Project {
  const timestamp = new Date().toISOString();
  return {
    format: "urania",
    version: "1.0.0",
    mechanismType: "volvelle",
    metadata: {
      name: "New Volvelle Project",
      author: "",
      description: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    settings: {
      units: "inches",
      canvasSize: {
        width: 12,
        height: 12,
      },
    },
    assets: [],
    mechanism: {
      id: crypto.randomUUID(),
      type: "volvelle",
      name: "Volvelle Root",
      visible: true,
      locked: false,
      transform: {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      children: [],
    },
  };
}

interface ProjectState {
  project: Project;
  setProject: (project: Project) => void;
  updateMetadata: (metadata: Partial<Project["metadata"]>) => void;
  updateSettings: (settings: Partial<Project["settings"]>) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: createEmptyProject(),
  setProject: (project) => set({ project }),
  updateMetadata: (metadata) =>
    set((state) => ({
      project: {
        ...state.project,
        metadata: {
          ...state.project.metadata,
          ...metadata,
          updatedAt: new Date().toISOString(),
        },
      },
    })),
  updateSettings: (settings) =>
    set((state) => ({
      project: {
        ...state.project,
        settings: {
          ...state.project.settings,
          ...settings,
        },
      },
    })),
}));
