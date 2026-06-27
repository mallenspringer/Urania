import { create } from "zustand";
import type { Project } from "../../shared/types/project";
import type { Command } from "../../shared/types/command";
import { validationRegistry } from "../validation/validationRegistry";


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
  past: Command[];
  future: Command[];
  setProject: (project: Project) => void;
  updateMetadata: (metadata: Partial<Project["metadata"]>) => void;
  updateSettings: (settings: Partial<Project["settings"]>) => void;
  executeCommand: (command: Command) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: createEmptyProject(),
  past: [],
  future: [],
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
  executeCommand: (command) => {
    const previousProjectState = useProjectStore.getState().project;
    try {
      command.execute();
      const nextProjectState = useProjectStore.getState().project;

      const validators = validationRegistry.getAllValidators();
      const errors: string[] = [];
      for (const val of validators) {
        const issues = val.validate(nextProjectState);
        for (const issue of issues) {
          if (issue.severity === "error") {
            errors.push(issue.message);
          }
        }
      }

      if (errors.length > 0) {
        command.undo();
        throw new Error(`Command validation failed: \n- ${errors.join("\n- ")}`);
      }

      set((state) => {
        const newPast = [...state.past, command];
        if (newPast.length > 100) {
          newPast.shift();
        }
        return {
          past: newPast,
          future: [],
        };
      });
    } catch (err: any) {
      set({ project: previousProjectState });
      console.error(err);
      throw err;
    }
  },
  undo: () => {
    set((state) => {
      if (state.past.length === 0) return {};
      const newPast = [...state.past];
      const command = newPast.pop()!;
      command.undo();
      return {
        past: newPast,
        future: [command, ...state.future],
      };
    });
  },
  redo: () => {
    set((state) => {
      if (state.future.length === 0) return {};
      const newFuture = [...state.future];
      const command = newFuture.shift()!;
      command.execute();
      return {
        past: [...state.past, command],
        future: newFuture,
      };
    });
  },
  clearHistory: () => set({ past: [], future: [] }),
}));
