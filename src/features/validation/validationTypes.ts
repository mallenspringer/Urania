import type { Project } from "../../shared/types/project";

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  entityId?: string;
  entityType?: string;
}

export interface Validator {
  id: string;
  name: string;
  validate(project: Project): ValidationIssue[];
}
