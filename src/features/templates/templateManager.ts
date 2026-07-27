import type { Project } from "../../shared/types/project";

const AUTOSAVE_KEY = "urania_autosave_project";
const BACKUP_KEY = "urania_backup_project";
const PREFS_KEY = "urania_user_preferences";

/**
 * Deep clones a Urania project structure and regenerates all node IDs to prevent
 * duplicate UUID conflicts when templates are instantiated.
 */
export function cloneProjectWithNewIds(project: Project, templateId?: string, templateVersion?: number): Project {
  const cloned = JSON.parse(JSON.stringify(project)) as Project;

  // Set origin template tags if template information was supplied
  if (templateId) {
    cloned.originTemplateId = templateId;
    cloned.originTemplateVersion = templateVersion;
  }

  // Set timestamps
  const now = new Date().toISOString();
  cloned.metadata.createdAt = now;
  cloned.metadata.updatedAt = now;

  // Traverse the mechanism nodes and refresh IDs
  const regenerateIds = (node: any) => {
    if (!node || typeof node !== "object") return;

    if (node.id) {
      node.id = crypto.randomUUID();
    }

    // Windows have inline shape definitions with independent IDs
    if (node.type === "window" && node.shape) {
      regenerateIds(node.shape);
    }

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(regenerateIds);
    }
  };

  regenerateIds(cloned.mechanism);
  return cloned;
}

/**
 * Saves project to local storage autosave slot.
 */
export function saveAutosave(project: Project): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  } catch (err) {
    console.error("Failed to write project autosave to localStorage:", err);
  }
}

/**
 * Loads project from local storage autosave slot.
 */
export function loadAutosave(): Project | null {
  try {
    const serialized = localStorage.getItem(AUTOSAVE_KEY);
    if (!serialized) return null;
    return JSON.parse(serialized) as Project;
  } catch (err) {
    console.error("Failed to parse project autosave from localStorage:", err);
    return null;
  }
}

/**
 * Clears autosave slot from local storage.
 */
export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

/**
 * Saves project to local storage backup slot.
 */
export function saveBackup(project: Project): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(project));
  } catch (err) {
    console.error("Failed to write project backup to localStorage:", err);
  }
}

/**
 * Loads project from local storage backup slot.
 */
export function loadBackup(): Project | null {
  try {
    const serialized = localStorage.getItem(BACKUP_KEY);
    if (!serialized) return null;
    return JSON.parse(serialized) as Project;
  } catch (err) {
    console.error("Failed to parse project backup from localStorage:", err);
    return null;
  }
}

export interface UserPreferences {
  theme: "dark" | "light";
  gridVisible: boolean;
  snapToAngles: boolean;
  snapToRadii: boolean;
  activeUnits: "inches" | "millimeters" | "pixels";
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  gridVisible: false,
  snapToAngles: true,
  snapToRadii: true,
  activeUnits: "pixels",
};

/**
 * Saves user preference flags to localStorage.
 */
export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error("Failed to save user preferences:", err);
  }
}

/**
 * Loads user preference flags from localStorage.
 */
export function loadPreferences(): UserPreferences {
  try {
    const serialized = localStorage.getItem(PREFS_KEY);
    if (!serialized) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(serialized) };
  } catch (err) {
    console.error("Failed to parse user preferences:", err);
    return DEFAULT_PREFERENCES;
  }
}
