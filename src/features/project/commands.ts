import type { Command } from "../../shared/types/command";
import type { RingNode, BaseNode } from "../../shared/types/project";
import { useProjectStore } from "./projectStore";

/**
 * Command to create a new ring and add it to the mechanism root.
 */
export class CreateRingCommand implements Command {
  private ring: RingNode;

  constructor(ring: RingNode) {
    this.ring = ring;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const children = store.project.mechanism.children || [];
    const updated = {
      ...store.project,
      mechanism: {
        ...store.project.mechanism,
        children: [...children, this.ring],
      },
    };
    store.setProject(updated);
  }

  undo(): void {
    const store = useProjectStore.getState();
    const children = store.project.mechanism.children || [];
    const updated = {
      ...store.project,
      mechanism: {
        ...store.project.mechanism,
        children: children.filter((c) => c.id !== this.ring.id),
      },
    };
    store.setProject(updated);
  }

  getLabel(): string {
    return "Create Ring";
  }
}

/**
 * Command to delete a ring, preserving its index for correct restoration.
 */
export class DeleteRingCommand implements Command {
  private ring: RingNode;
  private originalIndex: number = -1;

  constructor(ring: RingNode) {
    this.ring = ring;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const children = store.project.mechanism.children || [];
    this.originalIndex = children.findIndex((c) => c.id === this.ring.id);
    if (this.originalIndex === -1) return;

    const updated = {
      ...store.project,
      mechanism: {
        ...store.project.mechanism,
        children: children.filter((c) => c.id !== this.ring.id),
      },
    };
    store.setProject(updated);
  }

  undo(): void {
    if (this.originalIndex === -1) return;
    const store = useProjectStore.getState();
    const children = store.project.mechanism.children || [];
    const updatedChildren = [...children];
    updatedChildren.splice(this.originalIndex, 0, this.ring);

    const updated = {
      ...store.project,
      mechanism: {
        ...store.project.mechanism,
        children: updatedChildren,
      },
    };
    store.setProject(updated);
  }

  getLabel(): string {
    return "Delete Ring";
  }
}

/**
 * Command to rotate a ring from one angle to another.
 */
export class RotateRingCommand implements Command {
  private ringId: string;
  private fromRotation: number;
  private toRotation: number;

  constructor(ringId: string, fromRotation: number, toRotation: number) {
    this.ringId = ringId;
    this.fromRotation = fromRotation;
    this.toRotation = toRotation;
  }

  execute(): void {
    this.applyRotation(this.toRotation);
  }

  undo(): void {
    this.applyRotation(this.fromRotation);
  }

  private applyRotation(rotation: number): void {
    const store = useProjectStore.getState();
    const children = store.project.mechanism.children || [];
    const updatedChildren = children.map((c) => {
      if (c.id === this.ringId && c.type === "ring") {
        return {
          ...c,
          rotation,
        } as RingNode;
      }
      return c;
    });

    const updated = {
      ...store.project,
      mechanism: {
        ...store.project.mechanism,
        children: updatedChildren,
      },
    };
    store.setProject(updated);
  }

  getLabel(): string {
    return "Rotate Ring";
  }
}

// Helper to insert a node under a specific parent in the mechanism tree
function addNodeToTree(tree: BaseNode, parentId: string, nodeToAdd: BaseNode): boolean {
  if (tree.id === parentId) {
    if (!tree.children) tree.children = [];
    tree.children.push(nodeToAdd);
    return true;
  }
  if (tree.children) {
    for (const child of tree.children) {
      if (addNodeToTree(child, parentId, nodeToAdd)) return true;
    }
  }
  return false;
}

// Helper to remove a node from the mechanism tree
function removeNodeFromTree(tree: BaseNode, nodeId: string): { parentId: string; index: number; node: BaseNode } | null {
  if (tree.children) {
    const idx = tree.children.findIndex((c) => c.id === nodeId);
    if (idx !== -1) {
      const [node] = tree.children.splice(idx, 1);
      return { parentId: tree.id, index: idx, node };
    }
    for (const child of tree.children) {
      const res = removeNodeFromTree(child, nodeId);
      if (res) return res;
    }
  }
  return null;
}

/**
 * Command to create a generic node (shape, window, text, guide) under a parent.
 */
export class CreateNodeCommand implements Command {
  private parentId: string;
  private node: BaseNode;

  constructor(parentId: string, node: BaseNode) {
    this.parentId = parentId;
    this.node = node;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;
    if (addNodeToTree(mechanism, this.parentId, this.node)) {
      store.setProject({
        ...store.project,
        mechanism: mechanism as any,
      });
    }
  }

  undo(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;
    if (removeNodeFromTree(mechanism, this.node.id)) {
      store.setProject({
        ...store.project,
        mechanism: mechanism as any,
      });
    }
  }

  getLabel(): string {
    return `Create ${this.node.type}`;
  }
}

/**
 * Command to delete a node, preserving parent and index for restoration.
 */
export class DeleteNodeCommand implements Command {
  private nodeId: string;
  private removedInfo: { parentId: string; index: number; node: BaseNode } | null = null;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;
    const res = removeNodeFromTree(mechanism, this.nodeId);
    if (res) {
      this.removedInfo = res;
      store.setProject({
        ...store.project,
        mechanism: mechanism as any,
      });
    }
  }

  undo(): void {
    if (!this.removedInfo) return;
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;

    const insertNodeAt = (tree: BaseNode, parentId: string, node: BaseNode, index: number): boolean => {
      if (tree.id === parentId) {
        if (!tree.children) tree.children = [];
        tree.children.splice(index, 0, node);
        return true;
      }
      if (tree.children) {
        for (const child of tree.children) {
          if (insertNodeAt(child, parentId, node, index)) return true;
        }
      }
      return false;
    };

    if (insertNodeAt(mechanism, this.removedInfo.parentId, this.removedInfo.node, this.removedInfo.index)) {
      store.setProject({
        ...store.project,
        mechanism: mechanism as any,
      });
    }
  }

  getLabel(): string {
    return "Delete Node";
  }
}
