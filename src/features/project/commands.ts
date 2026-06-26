import type { Command } from "../../shared/types/command";
import type { RingNode } from "../../shared/types/project";
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
