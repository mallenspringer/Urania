import type { Asset, ImageNode } from "../../shared/types/project";
import { useProjectStore } from "../project/projectStore";
import { useSelectionStore } from "../selection/selectionStore";
import { useToolStore } from "./toolStore";
import { CreateNodeCommand, UpdateNodeCommand } from "../project/commands";

export async function importImageAsset(file: File, activeRingId: string | null): Promise<void> {
  const store = useProjectStore.getState();
  const project = store.project;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const embeddedData = e.target?.result as string;
      if (!embeddedData) {
        reject(new Error("Failed to read image file data."));
        return;
      }

      const assetId = `asset_${crypto.randomUUID()}`;
      const isSvg = file.type === "image/svg+xml" || file.name.endsWith(".svg");

      const newAsset: Asset = {
        id: assetId,
        type: isSvg ? "svg" : "image",
        mimeType: file.type || (isSvg ? "image/svg+xml" : "image/png"),
        embeddedData,
      };

      // Update project assets list
      const updatedAssets = [...(project.assets || []), newAsset];

      // Measure dimensions using HTML Image object
      const img = new Image();
      img.onload = () => {
        const aspect = img.width && img.height ? img.width / img.height : 1;
        const targetWidth = Math.min(150, img.width || 100);
        const targetHeight = Math.round(targetWidth / aspect);

        const imageNode: ImageNode = {
          id: `img_${crypto.randomUUID()}`,
          type: "image",
          name: file.name.replace(/\.[^/.]+$/, "") || "Imported Image",
          visible: true,
          locked: false,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          assetId,
          width: targetWidth,
          height: targetHeight,
          style: {
            opacity: 1,
          },
          export: {
            artwork: true,
            cut: false,
            fold: false,
          },
        };

        // Determine parent ID: active ring or mechanism root
        const rings = (project.mechanism.children || []).filter((c) => c.type === "ring");
        const parentId = activeRingId || (rings[0]?.id) || project.mechanism.id;

        store.setProject({
          ...store.project,
          assets: updatedAssets,
        });

        const cmd = new CreateNodeCommand(parentId, imageNode);
        store.executeCommand(cmd);
        useSelectionStore.getState().selectItem(imageNode.id, "image", false);
        resolve();
      };

      img.onerror = () => {
        // Fallback default dimensions if measurement fails
        const imageNode: ImageNode = {
          id: `img_${crypto.randomUUID()}`,
          type: "image",
          name: file.name.replace(/\.[^/.]+$/, "") || "Imported Image",
          visible: true,
          locked: false,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          assetId,
          width: 100,
          height: 100,
          style: { opacity: 1 },
          export: { artwork: true, cut: false, fold: false },
        };

        const rings = (project.mechanism.children || []).filter((c) => c.type === "ring");
        const parentId = activeRingId || (rings[0]?.id) || project.mechanism.id;

        store.setProject({
          ...store.project,
          assets: updatedAssets,
        });

        const cmd = new CreateNodeCommand(parentId, imageNode);
        store.executeCommand(cmd);
        useSelectionStore.getState().selectItem(imageNode.id, "image", false);
        resolve();
      };

      img.src = embeddedData;
    };

    reader.onerror = () => reject(new Error("File reading failed."));
    reader.readAsDataURL(file);
  });
}

export function resetImageNodeCrop(rawNode: any): void {
  if (!rawNode) return;

  const store = useProjectStore.getState();
  const origSnapshot = JSON.parse(JSON.stringify(rawNode));
  const updatedNode = JSON.parse(JSON.stringify(rawNode));

  const crop = rawNode.crop;
  delete updatedNode.crop;

  if (crop && crop.width > 0 && crop.height > 0) {
    const scaleX = (rawNode.width || 100) / crop.width;
    const scaleY = (rawNode.height || 100) / crop.height;

    // Estimate uncropped natural dimensions from current crop
    const naturalW = crop.x + crop.width;
    const naturalH = crop.y + crop.height;

    const fullWidth = naturalW * scaleX;
    const fullHeight = naturalH * scaleY;

    const localShiftX = (naturalW / 2 - crop.x - crop.width / 2) * scaleX;
    const localShiftY = (naturalH / 2 - crop.y - crop.height / 2) * scaleY;

    const rad = ((rawNode.transform?.rotation || 0) * Math.PI) / 180;
    const worldShiftX = localShiftX * Math.cos(rad) - localShiftY * Math.sin(rad);
    const worldShiftY = localShiftX * Math.sin(rad) + localShiftY * Math.cos(rad);

    updatedNode.width = fullWidth;
    updatedNode.height = fullHeight;
    if (updatedNode.transform) {
      updatedNode.transform.x = (rawNode.transform?.x || 0) + worldShiftX;
      updatedNode.transform.y = (rawNode.transform?.y || 0) + worldShiftY;
    }
  }

  store.executeCommand(new UpdateNodeCommand(rawNode.id, origSnapshot, updatedNode));
  useToolStore.getState().setCroppingImageNodeId(null);
}
