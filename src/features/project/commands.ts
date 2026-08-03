import type { Command } from "../../shared/types/command";
import type { RingNode, BaseNode } from "../../shared/types/project";
import { useProjectStore } from "./projectStore";
import { useSelectionStore } from "../selection/selectionStore";
import { findNodeInTree } from "../../shared/utils/geometry";

/**
 * Command to execute a batch/sequence of commands as a single atomic operation
 * in the undo/redo history queue.
 */
export class BatchCommand implements Command {
  private commands: Command[];
  private label: string;

  constructor(commands: Command[], label: string = "Batch Action") {
    this.commands = commands;
    this.label = label;
  }

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  getLabel(): string {
    return this.label;
  }
}

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

/**
 * Command to reorder ring layers within the mechanism children stack.
 */
export class ReorderRingsCommand implements Command {
  private fromIndex: number;
  private toIndex: number;

  constructor(fromIndex: number, toIndex: number) {
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
  }

  execute(): void {
    this.reorder(this.fromIndex, this.toIndex);
  }

  undo(): void {
    this.reorder(this.toIndex, this.fromIndex);
  }

  private reorder(from: number, to: number): void {
    const store = useProjectStore.getState();
    const children = store.project.mechanism.children || [];
    if (from < 0 || from >= children.length || to < 0 || to >= children.length || from === to) {
      return;
    }
    const updated = [...children];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);

    store.setProject({
      ...store.project,
      mechanism: {
        ...store.project.mechanism,
        children: updated,
      },
    });
  }

  getLabel(): string {
    return "Reorder Rings";
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
 * Command to create a generic node (shape, window, text, image, tab) under a parent.
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

/**
 * Command to delete single or multiple nodes at once, with undo/redo restoration.
 */
export class DeleteMultipleNodesCommand implements Command {
  private nodeIds: string[];
  private removedInfos: Array<{ parentId: string; index: number; node: BaseNode }> = [];

  constructor(nodeIds: string[]) {
    this.nodeIds = [...nodeIds];
  }

  execute(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;
    this.removedInfos = [];

    for (const id of this.nodeIds) {
      const res = removeNodeFromTree(mechanism, id);
      if (res) {
        this.removedInfos.push(res);
      }
    }

    if (this.removedInfos.length > 0) {
      store.setProject({
        ...store.project,
        mechanism: mechanism as any,
      });
      useSelectionStore.getState().clearSelection();
    }
  }

  undo(): void {
    if (this.removedInfos.length === 0) return;
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

    for (let i = this.removedInfos.length - 1; i >= 0; i--) {
      const info = this.removedInfos[i];
      insertNodeAt(mechanism, info.parentId, info.node, info.index);
    }

    store.setProject({
      ...store.project,
      mechanism: mechanism as any,
    });
  }

  getLabel(): string {
    return `Delete ${this.nodeIds.length} Object${this.nodeIds.length > 1 ? "s" : ""}`;
  }
}

/**
 * Command to update a node's properties (content, transform, dimensions).
 */
export class UpdateNodeCommand implements Command {
  private nodeId: string;
  private oldNode: BaseNode;
  private newNode: BaseNode;

  constructor(nodeId: string, oldNode: BaseNode, newNode: BaseNode) {
    this.nodeId = nodeId;
    this.oldNode = JSON.parse(JSON.stringify(oldNode));
    this.newNode = JSON.parse(JSON.stringify(newNode));
  }

  private updateInTree(tree: BaseNode, updated: BaseNode): boolean {
    if (tree.id === this.nodeId) {
      const children = tree.children;
      Object.assign(tree, updated);
      if (children) {
        tree.children = children;
      }
      return true;
    }
    if (tree.children) {
      for (let i = 0; i < tree.children.length; i++) {
        if (this.updateInTree(tree.children[i], updated)) return true;
      }
    }
    return false;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;
    if (this.updateInTree(mechanism, this.newNode)) {
      store.setProject({
        ...store.project,
        mechanism: mechanism as any,
      });
    }
  }

  undo(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;
    if (this.updateInTree(mechanism, this.oldNode)) {
      store.setProject({
        ...store.project,
        mechanism: mechanism as any,
      });
    }
  }

  getLabel(): string {
    return `Edit ${this.newNode.type}`;
  }
}

/**
 * Command to update multiple nodes at once in a single atomic history entry.
 */
export class UpdateMultipleNodesCommand implements Command {
  private updates: { nodeId: string; oldNode: BaseNode; newNode: BaseNode }[];

  constructor(updates: { nodeId: string; oldNode: BaseNode; newNode: BaseNode }[]) {
    this.updates = updates.map((u) => ({
      nodeId: u.nodeId,
      oldNode: JSON.parse(JSON.stringify(u.oldNode)),
      newNode: JSON.parse(JSON.stringify(u.newNode)),
    }));
  }

  private applyUpdate(tree: BaseNode, nodeId: string, updated: BaseNode): boolean {
    if (tree.id === nodeId) {
      const children = tree.children;
      Object.assign(tree, updated);
      if (children) {
        tree.children = children;
      }
      return true;
    }
    if (tree.children) {
      for (let i = 0; i < tree.children.length; i++) {
        if (this.applyUpdate(tree.children[i], nodeId, updated)) return true;
      }
    }
    return false;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;
    let anyApplied = false;
    for (const update of this.updates) {
      if (this.applyUpdate(mechanism, update.nodeId, update.newNode)) {
        anyApplied = true;
      }
    }
    if (anyApplied) {
      store.setProject({
        ...store.project,
        mechanism: mechanism as any,
      });
    }
  }

  undo(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;
    let anyApplied = false;
    for (const update of this.updates) {
      if (this.applyUpdate(mechanism, update.nodeId, update.oldNode)) {
        anyApplied = true;
      }
    }
    if (anyApplied) {
      store.setProject({
        ...store.project,
        mechanism: mechanism as any,
      });
    }
  }

  getLabel(): string {
    return `Update ${this.updates.length} Elements`;
  }
}



export class GroupNodesCommand implements Command {
  private parentId: string;
  private nodeIds: string[];
  private groupNode: BaseNode;
  private originalNodes: { parentId: string; index: number; node: BaseNode }[] = [];

  constructor(parentId: string, nodeIds: string[], groupNode: BaseNode) {
    this.parentId = parentId;
    this.nodeIds = nodeIds;
    this.groupNode = groupNode;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;

    // Remove original nodes and record their positions
    this.originalNodes = [];
    for (const id of this.nodeIds) {
      const removed = removeNodeFromTree(mechanism, id);
      if (removed) {
        this.originalNodes.push({
          parentId: removed.parentId,
          index: removed.index,
          node: removed.node,
        });
      }
    }

    // Add group node
    if (addNodeToTree(mechanism, this.parentId, this.groupNode)) {
      store.setProject({
        ...store.project,
        mechanism: mechanism as any,
      });
      // Update selection to select the group node
      useSelectionStore.getState().selectItem(this.groupNode.id, "group", false);
    }
  }

  undo(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;

    // Remove group node
    removeNodeFromTree(mechanism, this.groupNode.id);

    // Restore original nodes in reverse order to preserve correct indices
    const restored = [...this.originalNodes].reverse();
    for (const item of restored) {
      const parent = findNodeInTree(mechanism, item.parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.splice(item.index, 0, item.node);
      }
    }

    store.setProject({
      ...store.project,
      mechanism: mechanism as any,
    });

    // Restore selection
    const selection = useSelectionStore.getState();
    selection.clearSelection();
    this.nodeIds.forEach((id) => {
      const node = findNodeInTree(mechanism, id);
      if (node) {
        selection.selectItem(id, node.type, true);
      }
    });
  }

  getLabel(): string {
    return "Group Elements";
  }
}

export class UngroupNodesCommand implements Command {
  private groupNodeId: string;
  private parentId: string;
  private childNodes: BaseNode[];
  private originalGroupIndex: number = -1;
  private originalGroupNode: BaseNode | null = null;

  constructor(groupNodeId: string, parentId: string, childNodes: BaseNode[]) {
    this.groupNodeId = groupNodeId;
    this.parentId = parentId;
    this.childNodes = childNodes;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;

    // Find and remove the group node
    const removedGroup = removeNodeFromTree(mechanism, this.groupNodeId);
    if (removedGroup) {
      this.originalGroupIndex = removedGroup.index;
      this.originalGroupNode = removedGroup.node;
    }

    // Insert the children directly into parent node
    const parent = findNodeInTree(mechanism, this.parentId);
    if (parent) {
      if (!parent.children) parent.children = [];
      const idx = this.originalGroupIndex !== -1 ? this.originalGroupIndex : parent.children.length;
      parent.children.splice(idx, 0, ...this.childNodes);
    }

    store.setProject({
      ...store.project,
      mechanism: mechanism as any,
    });

    // Select the ungrouped child nodes
    const selection = useSelectionStore.getState();
    selection.clearSelection();
    this.childNodes.forEach((child) => {
      selection.selectItem(child.id, child.type, true);
    });
  }

  undo(): void {
    if (!this.originalGroupNode) return;
    const store = useProjectStore.getState();
    const mechanism = JSON.parse(JSON.stringify(store.project.mechanism)) as BaseNode;

    // Remove children from parent
    for (const child of this.childNodes) {
      removeNodeFromTree(mechanism, child.id);
    }

    // Restore the group node
    const parent = findNodeInTree(mechanism, this.parentId);
    if (parent) {
      if (!parent.children) parent.children = [];
      parent.children.splice(this.originalGroupIndex, 0, this.originalGroupNode);
    }

    store.setProject({
      ...store.project,
      mechanism: mechanism as any,
    });

    // Restore selection to the group node
    useSelectionStore.getState().selectItem(this.groupNodeId, "group", false);
  }

  getLabel(): string {
    return "Ungroup Elements";
  }
}

