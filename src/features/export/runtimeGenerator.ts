import type { Project } from "../../shared/types/project";
import { generateSVG } from "./svgExporter";
import JSZip from "jszip";

export interface RuntimeExportOptions {
  bundleType: "single" | "zip";
  persistenceMode: "persist-reset" | "always-reset";
  controlStyle: "bare" | "with-controls";
  theme: "dark" | "light";
}

// Injects SVG and scripting into interactive HTML template
export function generateInteractiveHTML(project: Project, options: RuntimeExportOptions): string {
  const svgContent = generateSVG(project, {
    layer: "all",
    includeRegistrationMarks: false,
    includeAlignmentTicks: false,
    embedAssets: true,
  });

  const ringsData = (project.mechanism.children || [])
    .filter((c) => c.type === "ring")
    .map((r: any) => ({
      id: r.id,
      name: r.name || `Ring (${r.id.substring(0, 4)})`,
      rotation: r.rotation,
      innerRadius: r.innerRadius,
      outerRadius: r.outerRadius,
    }));

  const bgStyle = options.theme === "dark" ? "#0b0c0f" : "#f8fafc";
  const textStyle = options.theme === "dark" ? "#cbd5e1" : "#1e293b";
  const titleStyle = options.theme === "dark" ? "#ffffff" : "#0f172a";
  const cardStyle = options.theme === "dark" ? "#181922" : "#ffffff";
  const borderStyle = options.theme === "dark" ? "#232530" : "#e2e8f0";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.metadata.name || "Urania Volvelle Runtime"}</title>
  <style>
    :root {
      --bg: ${bgStyle};
      --text: ${textStyle};
      --title: ${titleStyle};
      --card: ${cardStyle};
      --border: ${borderStyle};
      --accent: #6366f1;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Layout structure */
    .runtime-container {
      display: flex;
      flex-direction: row;
      width: 100%;
      max-width: 1200px;
      margin: 20px auto;
      gap: 24px;
      padding: 0 16px;
    }

    @media (max-width: 768px) {
      .runtime-container {
        flex-direction: column;
      }
    }

    /* Stage Panel */
    .stage-card {
      flex: 1;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      position: relative;
    }

    .stage-card svg {
      width: 100%;
      height: auto;
      max-width: 600px;
      max-height: 600px;
    }

    /* Control Panel HUD */
    .controls-card {
      width: 320px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    @media (max-width: 768px) {
      .controls-card {
        width: 100%;
      }
    }

    .header {
      margin-bottom: 10px;
    }

    h1 {
      font-size: 20px;
      color: var(--title);
      margin-bottom: 4px;
    }

    .description {
      font-size: 13px;
      color: var(--text);
      opacity: 0.8;
      line-height: 1.5;
    }

    /* Sliders styling */
    .ring-control {
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: rgba(99, 102, 241, 0.03);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
    }

    .ring-control-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
    }

    .ring-control input[type="range"] {
      width: 100%;
      accent-color: var(--accent);
      cursor: pointer;
    }

    .btn {
      background: var(--accent);
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: opacity 0.2s;
      text-align: center;
    }

    .btn:hover {
      opacity: 0.9;
    }

    /* Dials styling for interactive rotations */
    .volvelle-ring-group {
      cursor: grab;
      outline: none;
    }

    .volvelle-ring-group:active {
      cursor: grabbing;
    }

    .volvelle-ring-group:focus {
      filter: drop-shadow(0 0 4px var(--accent));
    }
  </style>
</head>
<body>

  <div class="runtime-container">
    <!-- Stage Area -->
    <div class="stage-card">
      ${svgContent}
    </div>

    <!-- Controls panel HUD -->
    ${options.controlStyle === "with-controls" ? `
    <div class="controls-card">
      <div class="header">
        <h1>${project.metadata.name || "Volvelle Dials"}</h1>
        <p class="description">${project.metadata.description || "Interactive paper-engineered mechanism."}</p>
      </div>

      <div class="controls-list" id="controls-list">
        ${ringsData.map((ring) => `
        <div class="ring-control" id="control-${ring.id}">
          <div class="ring-control-header">
            <span>${ring.name}</span>
            <span class="rotation-value" id="val-${ring.id}">${Math.round(ring.rotation)}°</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="360" 
            value="${ring.rotation}" 
            data-target-ring="${ring.id}" 
            class="ring-slider"
          />
        </div>
        `).join("")}
      </div>

      <button class="btn" onclick="reset()">Reset Mechanism</button>
    </div>
    ` : ""}
  </div>

  <script>
    // Initial Ring Configuration
    const rings = ${JSON.stringify(ringsData)};
    const ringStates = {};

    // Local Storage Configuration
    const projectId = "${project.metadata.name || 'unnamed-project'}";
    const storageKey = "urania-runtime-" + projectId;
    const persistenceEnabled = ${options.persistenceMode === "persist-reset"};

    // Setup initial angles
    rings.forEach(r => {
      ringStates[r.id] = {
        id: r.id,
        currentRotation: r.rotation,
        initialRotation: r.rotation
      };
    });

    // Restore from localStorage if enabled
    if (persistenceEnabled) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          Object.keys(parsed).forEach(id => {
            if (ringStates[id]) {
              ringStates[id].currentRotation = parsed[id];
              updateRingTransform(id, parsed[id]);
            }
          });
        }
      } catch (err) {
        console.error("Failed to restore rotations:", err);
      }
    }

    // Direct drag-rotation interaction
    let activeRingId = null;
    let startPointerAngle = 0;
    let startRingAngle = 0;

    // Attach event listeners to ring groups
    rings.forEach(r => {
      const g = document.getElementById("ring-group-" + r.id);
      if (g) {
        g.setAttribute("tabindex", "0"); // Make key-accessible
        
        // Mouse Down / Touch Start
        const handleStart = (clientX, clientY) => {
          activeRingId = r.id;
          const rect = g.getBoundingClientRect();
          // Center of the rotation (stage origin)
          const svgElement = g.ownerSVGElement;
          const svgRect = svgElement.getBoundingClientRect();
          const cx = svgRect.left + svgRect.width / 2;
          const cy = svgRect.top + svgRect.height / 2;

          startPointerAngle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
          startRingAngle = ringStates[r.id].currentRotation;
          document.body.style.userSelect = "none";
        };

        g.addEventListener("mousedown", (e) => {
          handleStart(e.clientX, e.clientY);
        });

        g.addEventListener("touchstart", (e) => {
          if (e.touches.length === 1) {
            handleStart(e.touches[0].clientX, e.touches[0].clientY);
          }
        });

        // Key Press rotation (Accessibility)
        g.addEventListener("keydown", (e) => {
          let delta = 0;
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -5;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = 5;
          
          if (delta !== 0) {
            e.preventDefault();
            const newAngle = (ringStates[r.id].currentRotation + delta + 360) % 360;
            setRingRotation(r.id, newAngle);
          }
        });
      }
    });

    // Document Mouse Move / Touch Move
    const handleMove = (clientX, clientY) => {
      if (!activeRingId) return;
      
      const g = document.getElementById("ring-group-" + activeRingId);
      if (!g) return;

      const svgElement = g.ownerSVGElement;
      const svgRect = svgElement.getBoundingClientRect();
      const cx = svgRect.left + svgRect.width / 2;
      const cy = svgRect.top + svgRect.height / 2;

      const currentPointerAngle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
      const delta = currentPointerAngle - startPointerAngle;
      const newAngle = (startRingAngle + delta + 360) % 360;

      setRingRotation(activeRingId, newAngle);
    };

    window.addEventListener("mousemove", (e) => {
      handleMove(e.clientX, e.clientY);
    });

    window.addEventListener("touchmove", (e) => {
      if (activeRingId && e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    });

    // Document Mouse Up / Touch End
    const handleEnd = () => {
      if (activeRingId) {
        activeRingId = null;
        document.body.style.userSelect = "";
        saveState();
      }
    };

    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchend", handleEnd);

    // Sidebar Sliders inputs listener
    document.querySelectorAll(".ring-slider").forEach(slider => {
      slider.addEventListener("input", (e) => {
        const ringId = e.target.getAttribute("data-target-ring");
        const val = parseFloat(e.target.value);
        setRingRotation(ringId, val);
      });
      slider.addEventListener("change", () => {
        saveState();
      });
    });

    // Core transformation utility
    function updateRingTransform(id, rotation) {
      const g = document.getElementById("ring-group-" + id);
      if (g) {
        g.setAttribute("transform", "rotate(" + rotation + ")");
      }
      
      // Update HUD value text
      const valText = document.getElementById("val-" + id);
      if (valText) {
        valText.innerText = Math.round(rotation) + "°";
      }

      // Update Slider value
      const slider = document.querySelector('[data-target-ring="' + id + '"]');
      if (slider) {
        slider.value = rotation;
      }
    }

    // Public API functions
    function setRingRotation(id, degrees) {
      if (ringStates[id]) {
        const normalized = (degrees + 360) % 360;
        ringStates[id].currentRotation = normalized;
        updateRingTransform(id, normalized);
      }
    }

    function getRingRotation(id) {
      return ringStates[id] ? ringStates[id].currentRotation : 0;
    }

    function reset() {
      rings.forEach(r => {
        setRingRotation(r.id, ringStates[r.id].initialRotation);
      });
      saveState();
    }

    function saveState() {
      if (!persistenceEnabled) return;
      const stateObj = {};
      Object.keys(ringStates).forEach(id => {
        stateObj[id] = ringStates[id].currentRotation;
      });
      localStorage.setItem(storageKey, JSON.stringify(stateObj));
    }

    // Expose APIs on window
    window.setRingRotation = setRingRotation;
    window.getRingRotation = getRingRotation;
    window.reset = reset;
  </script>
</body>
</html>
`;
}

// Packages the runtime files into a single ZIP archive using JSZip
export async function generateInteractiveZIP(project: Project, options: RuntimeExportOptions): Promise<Blob> {
  const zip = new JSZip();

  // 1. generate main HTML
  const singleHTML = generateInteractiveHTML(project, options);

  // 2. generate structural files for Developer Bundle ZIP
  zip.file("index.html", singleHTML);
  zip.file("project.json", JSON.stringify(project, null, 2));

  // generate export metadata manifest
  const manifest = {
    projectId: project.metadata.name || "unnamed-project",
    projectVersion: project.version || "1.0.0",
    exportVersion: "1.0.0",
    exportDate: new Date().toISOString(),
    exportPreset: "interactive-web",
    rings: (project.mechanism.children || [])
      .filter((c) => c.type === "ring")
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        outerRadius: r.outerRadius,
        innerRadius: r.innerRadius,
      })),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // return compiled ZIP blob
  return await zip.generateAsync({ type: "blob" });
}
