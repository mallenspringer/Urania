import type { Project, BaseNode } from "../../../shared/types/project";
import type { ValidationIssue, Validator } from "../validationTypes";

function traverseTree(
  node: BaseNode,
  seenIds: Set<string>,
  duplicateIds: Set<string>,
  issues: ValidationIssue[]
) {
  if (seenIds.has(node.id)) {
    duplicateIds.add(node.id);
    issues.push({
      id: `duplicate-uuid-${node.id}-${Math.random().toString(36).substring(2, 7)}`,
      severity: "error",
      code: "DUPLICATE_UUID",
      message: `Duplicate ID '${node.id}' detected on node '${node.name || node.type}'.`,
      entityId: node.id,
      entityType: node.type,
    });
  } else {
    seenIds.add(node.id);
  }

  // Check specific node types: Radial Pattern copies check
  if (node.type === "radialPattern") {
    const patternNode = node as any;
    if (patternNode.copies === undefined || patternNode.copies <= 0) {
      issues.push({
        id: `invalid-pattern-copies-${node.id}`,
        severity: "error",
        code: "INVALID_PATTERN_COPIES",
        message: `Radial pattern '${node.name || "Unnamed"}' must have copies > 0.`,
        entityId: node.id,
        entityType: node.type,
      });
    }
  }

  if (node.children) {
    for (const child of node.children) {
      traverseTree(child, seenIds, duplicateIds, issues);
    }
  }
}

function checkAssetReferences(node: BaseNode, project: Project, issues: ValidationIssue[]) {
  if (node.type === "image" || node.type === "svgAsset") {
    const assetNode = node as any;
    const exists = (project.assets || []).some((asset) => asset.id === assetNode.assetId);
    if (!exists) {
      issues.push({
        id: `missing-asset-${node.id}`,
        severity: "warning",
        code: "MISSING_ASSET",
        message: `${node.type === "image" ? "Image" : "SVG Asset"} '${node.name || "Unnamed"}' references a missing or deleted asset ID '${assetNode.assetId}'.`,
        entityId: node.id,
        entityType: node.type,
      });
    }
  }
  if (node.children) {
    for (const child of node.children) {
      checkAssetReferences(child, project, issues);
    }
  }
}

export const coreValidator: Validator = {
  id: "core-validator",
  name: "Core Validator",
  validate(project: Project): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seenIds = new Set<string>();
    const duplicateIds = new Set<string>();

    traverseTree(project.mechanism, seenIds, duplicateIds, issues);
    checkAssetReferences(project.mechanism, project, issues);

    return issues;
  },
};
