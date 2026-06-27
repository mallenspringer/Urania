import { create } from "zustand";
import { useProjectStore } from "../project/projectStore";

export interface SelectionItem {
  id: string;
  type: string;
}

interface SelectionState {
  selectedItems: SelectionItem[];
  activeItem: SelectionItem | null;
  activeRingId: string | null;
  selectItem: (id: string, type: string, isMultiSelect?: boolean) => void;
  deselectItem: (id: string) => void;
  clearSelection: () => void;
  setActiveRingId: (id: string | null) => void;
  setSelection: (items: SelectionItem[]) => void;
}

// Helper to find a node in the project tree
function findNodeInTree(node: any, id: string): any | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeInTree(child, id);
      if (found) return found;
    }
  }
  return null;
}

// Helper to check if a targetId is a descendant of parentNode
function isDescendantOf(parentNode: any, targetId: string): boolean {
  if (!parentNode.children) return false;
  for (const child of parentNode.children) {
    if (child.id === targetId) return true;
    if (isDescendantOf(child, targetId)) return true;
  }
  return false;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedItems: [],
  activeItem: null,
  activeRingId: null,

  selectItem: (id, type, isMultiSelect = false) =>
    set((state) => {
      const project = useProjectStore.getState().project;
      const root = project.mechanism;

      // Find the node being selected
      const selectedNode = findNodeInTree(root, id);

      const newItem = { id, type };

      if (!isMultiSelect) {
        return {
          selectedItems: [newItem],
          activeItem: newItem,
        };
      }

      // If already selected, bring it to focus as active item
      const exists = state.selectedItems.some((item) => item.id === id);
      if (exists) {
        return { activeItem: newItem };
      }

      // Filter out items that violate parent-child rule
      const filteredItems = state.selectedItems.filter((item) => {
        const itemNode = findNodeInTree(root, item.id);
        if (!itemNode || !selectedNode) return true;

        // 1. Is the existing item a child of the newly selected item?
        if (isDescendantOf(selectedNode, item.id)) {
          return false;
        }

        // 2. Is the newly selected item a child of the existing item?
        if (isDescendantOf(itemNode, id)) {
          return false;
        }

        return true;
      });

      const nextSelection = [...filteredItems, newItem];

      return {
        selectedItems: nextSelection,
        activeItem: newItem,
      };
    }),

  deselectItem: (id) =>
    set((state) => {
      const nextSelection = state.selectedItems.filter((item) => item.id !== id);
      return {
        selectedItems: nextSelection,
        activeItem:
          nextSelection.length > 0 ? nextSelection[nextSelection.length - 1] : null,
      };
    }),

  clearSelection: () => set({ selectedItems: [], activeItem: null }),

  setActiveRingId: (id) => set({ activeRingId: id }),

  setSelection: (items) =>
    set({
      selectedItems: items,
      activeItem: items.length > 0 ? items[items.length - 1] : null,
    }),
}));
