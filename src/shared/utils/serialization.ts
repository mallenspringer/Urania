import type { Project } from "../types/project";

/**
 * Recursively sorts the keys of an object to ensure deterministic outputs.
 */
export function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }

  const sortedObj: Record<string, any> = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sortedObj[key] = sortKeys(obj[key]);
  }
  return sortedObj;
}

/**
 * Deterministically serializes a Urania project to a pretty-printed JSON string.
 */
export function serializeProject(project: Project): string {
  const sorted = sortKeys(project);
  return JSON.stringify(sorted, null, 2);
}

/**
 * Parses and validates a Urania project JSON string.
 */
export function deserializeProject(json: string): Project {
  if (!json || json.trim() === "") {
    throw new Error("Project JSON is empty");
  }

  const project = JSON.parse(json) as Project;

  // Basic validation check based on the serialization specs
  if (!project) {
    throw new Error("Parsed project data is null");
  }
  if (project.format !== "urania") {
    throw new Error("Invalid project format. Expected 'urania'.");
  }
  if (!project.version) {
    throw new Error("Missing format version.");
  }
  if (project.mechanismType !== "volvelle") {
    throw new Error(`Unsupported mechanism type: '${project.mechanismType}'`);
  }
  if (!project.mechanism || project.mechanism.type !== "volvelle") {
    throw new Error("Missing or invalid mechanism root.");
  }

  return project;
}
