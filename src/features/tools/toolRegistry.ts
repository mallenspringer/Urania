import type { Tool } from "./toolTypes";
import { selectTool } from "./selectTool";
import { rectangleTool, circleTool, polygonTool } from "./shapeTool";
import { windowCircleTool, windowRectangleTool, windowPolygonTool } from "./windowTool";
import { textTool, arcTextTool } from "./textTool";
import { radialGuideTool, circularGuideTool } from "./guideTool";

class Registry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    this.tools.set(tool.id, tool);
  }

  getTool(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }
}

export const toolRegistry = new Registry();

// Register default tools
toolRegistry.register(selectTool);
toolRegistry.register(rectangleTool);
toolRegistry.register(circleTool);
toolRegistry.register(polygonTool);
toolRegistry.register(windowCircleTool);
toolRegistry.register(windowRectangleTool);
toolRegistry.register(windowPolygonTool);
toolRegistry.register(textTool);
toolRegistry.register(arcTextTool);
toolRegistry.register(radialGuideTool);
toolRegistry.register(circularGuideTool);
