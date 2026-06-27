import { create } from "zustand";
import { useProjectStore } from "../project/projectStore";
import { validationRegistry } from "./validationRegistry";
import type { ValidationIssue } from "./validationTypes";
import type { Project } from "../../shared/types/project";


// Helper function to repair duplicate UUIDs by generating unique ones
export function repairDuplicateUUIDs(project: Project): Project {
  const cloned = JSON.parse(JSON.stringify(project));
  const seen = new Set<string>();

  function repairNode(node: any) {
    if (seen.has(node.id)) {
      const oldId = node.id;
      node.id = crypto.randomUUID();
      console.log(`[Auto-Repair] Replaced duplicate UUID '${oldId}' with unique '${node.id}' on node '${node.name || node.type}'`);
    } else {
      seen.add(node.id);
    }
    if (node.children) {
      for (const child of node.children) {
        repairNode(child);
      }
    }
    if (node.type === "window" && node.shape) {
      repairNode(node.shape);
    }
  }

  repairNode(cloned.mechanism);
  return cloned;
}

interface ValidationState {
  issues: ValidationIssue[];
  validateProject: (project: Project) => ValidationIssue[];
  autoRepairDuplicates: () => void;
}

export const useValidationStore = create<ValidationState>((set) => ({
  issues: [],

  validateProject: (project) => {
    const validators = validationRegistry.getAllValidators();
    const allIssues: ValidationIssue[] = [];

    for (const validator of validators) {
      try {
        const issues = validator.validate(project);
        allIssues.push(...issues);
      } catch (err) {
        console.error(`Validator '${validator.name}' failed:`, err);
      }
    }

    set({ issues: allIssues });
    return allIssues;
  },

  autoRepairDuplicates: () => {
    const currentProject = useProjectStore.getState().project;
    const repaired = repairDuplicateUUIDs(currentProject);
    useProjectStore.getState().setProject(repaired);
  },
}));

// Subscribe to ProjectStore state updates to run validation continuously
useProjectStore.subscribe((state) => {
  useValidationStore.getState().validateProject(state.project);
});

// Run initial validation on first load
setTimeout(() => {
  const initProject = useProjectStore.getState().project;
  if (initProject) {
    useValidationStore.getState().validateProject(initProject);
  }
}, 50);
