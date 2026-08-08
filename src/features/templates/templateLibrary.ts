import type { Project, RingNode, SectorNode, ArcTextNode, CircleNode, PolygonNode, WindowNode } from "../../shared/types/project";

export interface TemplateManifest {
  id: string;
  name: string;
  description: string;
  version: number;
  mechanismType: "volvelle";
  author: string;
  createdDate: string;
  updatedDate: string;
  tags: string[];
}

export interface Template {
  manifest: TemplateManifest;
  project: Project;
}

const now = new Date().toISOString();

// Helper to generate a basic transform
const createTransform = (x = 0, y = 0, rotation = 0) => ({
  x,
  y,
  rotation,
  scaleX: 1,
  scaleY: 1,
});

// Helper to generate standard export flags
const createExportFlags = (artwork = true, cut = false, fold = false) => ({
  artwork,
  cut,
  fold,
});

export const BLANK_TEMPLATE: Template = {
  manifest: {
    id: "blank-volvelle",
    name: "Blank Volvelle",
    description: "A fresh project workspace with a single ring. Clean starting point for completely custom designs.",
    version: 1,
    mechanismType: "volvelle",
    author: "Urania System",
    createdDate: now,
    updatedDate: now,
    tags: ["Blank", "Core"],
  },
  project: {
    format: "urania",
    version: "1.0.0",
    mechanismType: "volvelle",
    metadata: {
      name: "Blank Volvelle Project",
      author: "Urania User",
      description: "Started from a blank template.",
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      units: "pixels",
      canvasSize: { width: 800, height: 800 },
    },
    assets: [],
    mechanism: {
      id: "volvelle-root",
      type: "volvelle",
      name: "Volvelle Root",
      visible: true,
      locked: false,
      transform: createTransform(),
      children: [
        {
          id: "ring-base",
          type: "ring",
          name: "Base Ring",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 60,
          outerRadius: 200,
          rotation: 0,
          children: [],
        } as RingNode,
      ],
    },
  },
};

// Zodiac Wheel
const zodiacNames = [
  { name: "ARIES ♈", angle: 0 },
  { name: "TAURUS ♉", angle: 30 },
  { name: "GEMINI ♊", angle: 60 },
  { name: "CANCER ♋", angle: 90 },
  { name: "LEO ♌", angle: 120 },
  { name: "VIRGO ♍", angle: 150 },
  { name: "LIBRA ♎", angle: 180 },
  { name: "SCORPIO ♏", angle: 210 },
  { name: "SAGITTARIUS ♐", angle: 240 },
  { name: "CAPRICORN ♑", angle: 270 },
  { name: "AQUARIUS ♒", angle: 300 },
  { name: "PISCES ♓", angle: 330 },
];

export const ZODIAC_TEMPLATE: Template = {
  manifest: {
    id: "zodiac-wheel",
    name: "Zodiac Calendar Wheel",
    description: "An astrological alignment wheel. The outer base disc contains 12 zodiac wedges, and the inner dial features a cutout window revealing the active sign.",
    version: 1,
    mechanismType: "volvelle",
    author: "Urania System",
    createdDate: now,
    updatedDate: now,
    tags: ["Examples", "Calendar"],
  },
  project: {
    format: "urania",
    version: "1.0.0",
    mechanismType: "volvelle",
    metadata: {
      name: "Zodiac Calendar Wheel",
      author: "Urania System",
      description: "An astrological calendar volvelle demonstrating multi-sector labels and masking cutouts.",
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      units: "pixels",
      canvasSize: { width: 800, height: 800 },
    },
    assets: [],
    mechanism: {
      id: "volvelle-root",
      type: "volvelle",
      name: "Volvelle Root",
      visible: true,
      locked: false,
      transform: createTransform(),
      children: [
        // Outer Base Ring with Zodiac Wedges
        {
          id: "ring-zodiac-base",
          type: "ring",
          name: "Base Zodiac Ring",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 100,
          outerRadius: 260,
          rotation: 0,
          children: zodiacNames.map(({ name, angle }) => ({
            id: `sector-${angle}`,
            type: "sector",
            name: `${name.split(" ")[0]} Sector`,
            visible: true,
            locked: false,
            transform: createTransform(),
            startAngle: angle,
            endAngle: angle + 30,
            children: [
              {
                id: `label-${angle}`,
                type: "arcText",
                name: `${name.split(" ")[0]} Arc Label`,
                visible: true,
                locked: false,
                transform: createTransform(),
                style: { fill: "#f1f5f9" },
                export: createExportFlags(true, false, false),
                content: name,
                radius: 200,
                startAngle: 2,
                sweepAngle: 26,
                fontFamily: "Outfit, sans-serif",
                fontSize: 13,
              } as ArcTextNode,
            ],
          } as SectorNode)),
        } as RingNode,

        // Inner Dial Cover Ring with Circular Reveal Window
        {
          id: "ring-zodiac-cover",
          type: "ring",
          name: "Top Window Dial",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 0,
          outerRadius: 260,
          rotation: 15, // centered on first sector offset
          children: [
            // Zodiac cutout window at radius 200
            {
              id: "window-zodiac-reveal",
              type: "window",
              name: "Zodiac Cutout Window",
              visible: true,
              locked: false,
              transform: createTransform(200, 0),
              style: {},
              export: createExportFlags(false, true, false),
              shape: {
                id: "window-zodiac-shape",
                type: "circle",
                visible: true,
                locked: false,
                transform: createTransform(),
                style: {},
                export: createExportFlags(false, true, false),
                radius: 35,
              } as CircleNode,
            } as WindowNode,
            // Simple triangle indicator pointing to the window
            {
              id: "indicator-triangle",
              type: "polygon",
              name: "Pointer Arrow",
              visible: true,
              locked: false,
              transform: createTransform(150, 0, 90), // Point outward along x-axis
              style: { fill: "#c084fc", stroke: "#a855f7", strokeWidth: 1.5 },
              export: createExportFlags(true, false, false),
              sides: 3,
              radius: 12,
              cornerRadius: 0,
            } as PolygonNode,
            // Instruction arc text
            {
              id: "zodiac-cover-title",
              type: "arcText",
              name: "Cover Banner",
              visible: true,
              locked: false,
              transform: createTransform(),
              style: { fill: "#c084fc" },
              export: createExportFlags(true, false, false),
              content: "✦ ROTATE TO CHOOSE ASTRO SIGN ✦",
              radius: 120,
              startAngle: -90,
              sweepAngle: 180,
              fontFamily: "Outfit, sans-serif",
              fontSize: 10,
            } as ArcTextNode,
            // Center decorative hub
            {
              id: "decorative-star",
              type: "polygon",
              name: "Central Star Hub",
              visible: true,
              locked: false,
              transform: createTransform(0, 0, 30),
              style: { fill: "rgba(192, 132, 252, 0.1)", stroke: "#c084fc", strokeWidth: 1 },
              export: createExportFlags(true, false, false),
              sides: 6,
              radius: 40,
              cornerRadius: 0,
            } as PolygonNode,
            // Center dial dividing circle
            {
              id: "cover-inner-circle",
              type: "circle",
              name: "Inner Circle Ring",
              visible: true,
              locked: false,
              transform: createTransform(),
              style: { stroke: "rgba(192, 132, 252, 0.4)", strokeWidth: 1 },
              export: createExportFlags(true, false, false),
              radius: 155,
            } as any,
          ],
        } as RingNode,
      ],
    },
  },
};

// Caesar Cipher Decoder Wheel
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const angleStep = 360 / 26; // ~13.846 deg

export const DECODER_TEMPLATE: Template = {
  manifest: {
    id: "decoder-wheel",
    name: "Caesar Cipher Decoder",
    description: "A classic cryptography tool. Rotate the inner alphabet ring relative to the outer ring to decode secret messages with a key shift.",
    version: 1,
    mechanismType: "volvelle",
    author: "Urania System",
    createdDate: now,
    updatedDate: now,
    tags: ["Utilities", "Games"],
  },
  project: {
    format: "urania",
    version: "1.0.0",
    mechanismType: "volvelle",
    metadata: {
      name: "Caesar Cipher Decoder",
      author: "Urania System",
      description: "A dual-alphabet decoder wheel demonstrating exact multi-sector placement and shift indexing.",
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      units: "pixels",
      canvasSize: { width: 800, height: 800 },
    },
    assets: [],
    mechanism: {
      id: "volvelle-root",
      type: "volvelle",
      name: "Volvelle Root",
      visible: true,
      locked: false,
      transform: createTransform(),
      children: [
        // Outer Alphabet Ring (A-Z)
        {
          id: "ring-decoder-outer",
          type: "ring",
          name: "Outer Alphabet (A-Z)",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 180,
          outerRadius: 250,
          rotation: 0,
          children: alphabet.map((letter, i) => {
            const startAngle = i * angleStep;
            return {
              id: `outer-sec-${letter}`,
              type: "sector",
              name: `Outer ${letter} Sector`,
              visible: true,
              locked: false,
              transform: createTransform(),
              startAngle,
              endAngle: startAngle + angleStep,
              children: [
                {
                  id: `outer-lbl-${letter}`,
                  type: "arcText",
                  name: `Outer ${letter} Label`,
                  visible: true,
                  locked: false,
                  transform: createTransform(),
                  style: { fill: "#cbd5e1" },
                  export: createExportFlags(true, false, false),
                  content: letter,
                  radius: 215,
                  startAngle: 1.5,
                  sweepAngle: 10.8,
                  fontFamily: "Outfit, monospace",
                  fontSize: 14,
                } as ArcTextNode,
              ],
            } as SectorNode;
          }),
        } as RingNode,

        // Inner Alphabet Ring (A-Z)
        {
          id: "ring-decoder-inner",
          type: "ring",
          name: "Inner Alphabet (A-Z)",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 110,
          outerRadius: 180,
          rotation: angleStep * 3, // Shifted by 3 letters initially
          children: alphabet.map((letter, i) => {
            const startAngle = i * angleStep;
            return {
              id: `inner-sec-${letter}`,
              type: "sector",
              name: `Inner ${letter} Sector`,
              visible: true,
              locked: false,
              transform: createTransform(),
              startAngle,
              endAngle: startAngle + angleStep,
              children: [
                {
                  id: `inner-lbl-${letter}`,
                  type: "arcText",
                  name: `Inner ${letter} Label`,
                  visible: true,
                  locked: false,
                  transform: createTransform(),
                  style: { fill: "#a7f3d0" },
                  export: createExportFlags(true, false, false),
                  content: letter,
                  radius: 145,
                  startAngle: 1.5,
                  sweepAngle: 10.8,
                  fontFamily: "Outfit, monospace",
                  fontSize: 12,
                } as ArcTextNode,
              ],
            } as SectorNode;
          }),
        } as RingNode,

        // Central Pin Wheel Hub
        {
          id: "ring-decoder-hub",
          type: "ring",
          name: "Center Pin Hub",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 0,
          outerRadius: 110,
          rotation: 0,
          children: [
            {
              id: "hub-label",
              type: "arcText",
              name: "Hub Label",
              visible: true,
              locked: false,
              transform: createTransform(),
              style: { fill: "#f43f5e" },
              export: createExportFlags(true, false, false),
              content: "✦ CRYPTO-DECODER ✦",
              radius: 75,
              startAngle: -45,
              sweepAngle: 90,
              fontFamily: "Outfit, sans-serif",
              fontSize: 9,
            } as ArcTextNode,
            {
              id: "hub-decorative-circle",
              type: "circle",
              name: "Center Hub Circle",
              visible: true,
              locked: false,
              transform: createTransform(),
              style: { stroke: "#f43f5e", strokeWidth: 1.5 },
              export: createExportFlags(true, false, false),
              radius: 50,
            } as any,
          ],
        } as RingNode,
      ],
    },
  },
};

// RPG Action Spinner
const spinnerWedges = [
  { text: "ATTACK ⚔️", color: "rgba(239, 68, 68, 0.2)", stroke: "#ef4444" },
  { text: "DEFEND 🛡️", color: "rgba(59, 130, 246, 0.2)", stroke: "#3b82f6" },
  { text: "HEAL 🧪", color: "rgba(16, 185, 129, 0.2)", stroke: "#10b981" },
  { text: "FIRE 🔥", color: "rgba(249, 115, 22, 0.2)", stroke: "#f97316" },
  { text: "ICE ❄️", color: "rgba(56, 189, 248, 0.2)", stroke: "#38bdf8" },
  { text: "ITEM 🎒", color: "rgba(168, 85, 247, 0.2)", stroke: "#a855f7" },
  { text: "CRIT 💥", color: "rgba(234, 179, 8, 0.2)", stroke: "#eab308" },
  { text: "FLEE 🏃", color: "rgba(236, 72, 153, 0.2)", stroke: "#ec4899" },
];

export const GAME_TEMPLATE: Template = {
  manifest: {
    id: "action-spinner",
    name: "RPG Action Spinner",
    description: "A decision maker or game spinner. Features 8 colored wedges (Attack, Defend, Heal, Fire, Ice, Crit, Item, Flee) and a selector window cover.",
    version: 1,
    mechanismType: "volvelle",
    author: "Urania System",
    createdDate: now,
    updatedDate: now,
    tags: ["Games", "Utilities"],
  },
  project: {
    format: "urania",
    version: "1.0.0",
    mechanismType: "volvelle",
    metadata: {
      name: "RPG Action Spinner",
      author: "Urania System",
      description: "An RPG battle action chooser wheel featuring 8 action sectors and a selection dial.",
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      units: "pixels",
      canvasSize: { width: 800, height: 800 },
    },
    assets: [],
    mechanism: {
      id: "volvelle-root",
      type: "volvelle",
      name: "Volvelle Root",
      visible: true,
      locked: false,
      transform: createTransform(),
      children: [
        // Action Sectors Base
        {
          id: "ring-spinner-base",
          type: "ring",
          name: "Action Board Ring",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 40,
          outerRadius: 240,
          rotation: 0,
          children: spinnerWedges.map(({ text, color, stroke }, i) => {
            const startAngle = i * 45;
            return {
              id: `wedge-sec-${i}`,
              type: "sector",
              name: `${text.split(" ")[0]} Wedge`,
              visible: true,
              locked: false,
              transform: createTransform(),
              startAngle,
              endAngle: startAngle + 45,
              style: { fill: color, stroke: stroke, strokeWidth: 1.5 },
              children: [
                {
                  id: `wedge-lbl-${i}`,
                  type: "arcText",
                  name: `${text.split(" ")[0]} Arc Label`,
                  visible: true,
                  locked: false,
                  transform: createTransform(),
                  style: { fill: "#f8fafc" },
                  export: createExportFlags(true, false, false),
                  content: text,
                  radius: 150,
                  startAngle: 4,
                  sweepAngle: 37,
                  fontFamily: "Outfit, sans-serif",
                  fontSize: 13,
                } as ArcTextNode,
              ],
            } as SectorNode;
          }),
        } as RingNode,

        // Top Selector cover dial
        {
          id: "ring-spinner-selector",
          type: "ring",
          name: "Cover Selector Dial",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 0,
          outerRadius: 240,
          rotation: 22.5, // Center pointer inside first sector (offset 22.5)
          children: [
            // cutout circular window revealing action text
            {
              id: "window-action-reveal",
              type: "window",
              name: "Action Window Cutout",
              visible: true,
              locked: false,
              transform: createTransform(150, 0),
              style: {},
              export: createExportFlags(false, true, false),
              shape: {
                id: "window-action-shape",
                type: "circle",
                visible: true,
                locked: false,
                transform: createTransform(),
                style: {},
                export: createExportFlags(false, true, false),
                radius: 40,
              } as CircleNode,
            } as WindowNode,
            // small pointer arrow pointing outwards to window
            {
              id: "spinner-arrow",
              type: "polygon",
              name: "Selector Pointer",
              visible: true,
              locked: false,
              transform: createTransform(95, 0, 90),
              style: { fill: "#f59e0b", stroke: "#d97706", strokeWidth: 1.5 },
              export: createExportFlags(true, false, false),
              sides: 3,
              radius: 12,
              cornerRadius: 0,
            } as PolygonNode,
            // Circular text
            {
              id: "spinner-title",
              type: "arcText",
              name: "Cover Spinner Banner",
              visible: true,
              locked: false,
              transform: createTransform(),
              style: { fill: "#cbd5e1" },
              export: createExportFlags(true, false, false),
              content: "✦ BATTLE ACTION SPINNER ✦",
              radius: 70,
              startAngle: -120,
              sweepAngle: 240,
              fontFamily: "Outfit, sans-serif",
              fontSize: 10,
            } as ArcTextNode,
            // Center pin circular line
            {
              id: "spinner-hub",
              type: "circle",
              name: "Cover Pin Hub",
              visible: true,
              locked: false,
              transform: createTransform(),
              style: { stroke: "#cbd5e1", strokeWidth: 1 },
              export: createExportFlags(true, false, false),
              radius: 100,
            } as any,
          ],
        } as RingNode,
      ],
    },
  },
};

export const DIAGNOSTIC_3LAYER_TEMPLATE: Template = {
  manifest: {
    id: "3-layer-diagnostic-test",
    name: "3-Layer Diagnostic Test",
    description: "A 3-dial test template for verifying multi-layer masking, star windows, circle windows, text windows, crescent moon shapes, arc text, solid polygons, void windows, and attached disc tabs.",
    version: 2,
    mechanismType: "volvelle",
    author: "Urania System",
    createdDate: now,
    updatedDate: now,
    tags: ["Diagnostic", "Test", "Examples"],
  },
  project: {
    format: "urania",
    version: "1.0.0",
    mechanismType: "volvelle",
    metadata: {
      name: "3-Layer Diagnostic Test",
      author: "Urania System",
      description: "A 3-dial diagnostic volvelle with red base, green middle ring, purple top ring, attached tabs, crescent moon, arc text, solid polygon, and void window.",
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      units: "pixels",
      canvasSize: { width: 800, height: 800 },
    },
    assets: [],
    mechanism: {
      id: "volvelle-root",
      type: "volvelle",
      name: "Volvelle Root",
      visible: true,
      locked: false,
      transform: createTransform(),
      children: [
        // 1. Bottom Ring (Red)
        {
          id: "ring-bottom-red",
          type: "ring",
          name: "Bottom Ring (Red)",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 5,
          outerRadius: 220,
          rotation: 0,
          style: { fill: "#ef4444", stroke: "#b91c1c", strokeWidth: 1.5 },
          children: [
            // Center label
            {
              id: "red-bottom-label",
              type: "text",
              name: "Base Label",
              visible: true,
              locked: false,
              transform: createTransform(0, -180),
              style: { fill: "#ffffff" },
              export: createExportFlags(true, false, false),
              content: "RED BOTTOM LAYER",
              fontFamily: "Outfit, sans-serif",
              fontSize: 16,
            } as any,
            // Additional regular text object
            {
              id: "bottom-regular-text",
              type: "text",
              name: "Bottom Regular Text",
              visible: true,
              locked: false,
              transform: createTransform(0, 80),
              style: { fill: "#ffffff" },
              export: createExportFlags(true, false, false),
              content: "BOTTOM LAYER TEXT",
              fontFamily: "Outfit, sans-serif",
              fontSize: 16,
            } as any,
            // Quadrant 1 accent circle
            {
              id: "red-acc-q1",
              type: "circle",
              name: "Q1 Accent",
              visible: true,
              locked: false,
              transform: createTransform(120, -120),
              style: { fill: "#fef08a", stroke: "#eab308", strokeWidth: 2 },
              export: createExportFlags(true, false, false),
              radius: 35,
            } as any,
            // Quadrant 3 accent star
            {
              id: "red-acc-q3",
              type: "star",
              name: "Q3 Accent Star",
              visible: true,
              locked: false,
              transform: createTransform(-120, 120),
              style: { fill: "#fef08a", stroke: "#eab308", strokeWidth: 2 },
              export: createExportFlags(true, false, false),
              outerRadius: 35,
              innerRadius: 15,
              numPoints: 5,
            } as any,
            // Small cutout window that peers into the void
            {
              id: "win-bottom-void",
              type: "window",
              name: "Void Cutout Window",
              visible: true,
              locked: false,
              transform: createTransform(0, 140),
              style: {},
              export: createExportFlags(false, true, false),
              shape: {
                id: "bottom-void-shape",
                type: "circle",
                visible: true,
                locked: false,
                transform: createTransform(),
                style: {},
                export: createExportFlags(false, true, false),
                radius: 20,
              } as CircleNode,
            } as WindowNode,
            // Attached Disc Tab on Bottom Ring (180 deg / Left)
            {
              id: "tab-bottom-red",
              type: "discTab",
              name: "Bottom Disc Tab",
              visible: true,
              locked: false,
              transform: createTransform(-220, 0, 180),
              style: { fill: "#ef4444", stroke: "#b91c1c", strokeWidth: 1.5 },
              export: createExportFlags(true, true, false),
              angle: 180,
              width: 30,
              height: 18,
              cornerRadius: 4,
              tabShape: "semicircular",
              label: "#1",
            } as DiscTabNode,
          ],
        } as RingNode,

        // 2. Middle Ring (Green)
        {
          id: "ring-middle-green",
          type: "ring",
          name: "Middle Ring (Green)",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 5,
          outerRadius: 210,
          rotation: 0,
          style: { fill: "#10b981", stroke: "#047857", strokeWidth: 1.5 },
          children: [
            // Solid crescent moon shape
            {
              id: "middle-crescent-moon",
              type: "crescent",
              name: "Crescent Moon",
              visible: true,
              locked: false,
              transform: createTransform(-140, 0, 15),
              style: { fill: "#000000", stroke: "#ffffff", strokeWidth: 2 },
              export: createExportFlags(true, false, false),
              radius: 35,
              phase: 0.5,
            } as any,
            // Star Window in Quadrant 1 (top-right)
            {
              id: "win-star-q1",
              type: "window",
              name: "Star Window Q1",
              visible: true,
              locked: false,
              transform: createTransform(120, -120),
              style: {},
              export: createExportFlags(false, true, false),
              shape: {
                id: "star-shape-q1",
                type: "star",
                visible: true,
                locked: false,
                transform: createTransform(),
                style: {},
                export: createExportFlags(false, true, false),
                outerRadius: 35,
                innerRadius: 15,
                numPoints: 5,
              } as any,
            } as WindowNode,
            // Star Window in Quadrant 2 (top-left)
            {
              id: "win-star-q2",
              type: "window",
              name: "Star Window Q2",
              visible: true,
              locked: false,
              transform: createTransform(-120, -120),
              style: {},
              export: createExportFlags(false, true, false),
              shape: {
                id: "star-shape-q2",
                type: "star",
                visible: true,
                locked: false,
                transform: createTransform(),
                style: {},
                export: createExportFlags(false, true, false),
                outerRadius: 35,
                innerRadius: 15,
                numPoints: 5,
              } as any,
            } as WindowNode,
            // Star Window in Quadrant 3 (bottom-left)
            {
              id: "win-star-q3",
              type: "window",
              name: "Star Window Q3",
              visible: true,
              locked: false,
              transform: createTransform(-120, 120),
              style: {},
              export: createExportFlags(false, true, false),
              shape: {
                id: "star-shape-q3",
                type: "star",
                visible: true,
                locked: false,
                transform: createTransform(),
                style: {},
                export: createExportFlags(false, true, false),
                outerRadius: 35,
                innerRadius: 15,
                numPoints: 5,
              } as any,
            } as WindowNode,
            // Star Window in Quadrant 4 (bottom-right)
            {
              id: "win-star-q4",
              type: "window",
              name: "Star Window Q4",
              visible: true,
              locked: false,
              transform: createTransform(120, 120),
              style: {},
              export: createExportFlags(false, true, false),
              shape: {
                id: "star-shape-q4",
                type: "star",
                visible: true,
                locked: false,
                transform: createTransform(),
                style: {},
                export: createExportFlags(false, true, false),
                outerRadius: 35,
                innerRadius: 15,
                numPoints: 5,
              } as any,
            } as WindowNode,
            // Attached Disc Tab on Middle Ring (120 deg)
            {
              id: "tab-middle-green",
              type: "discTab",
              name: "Middle Disc Tab",
              visible: true,
              locked: false,
              transform: createTransform(-105, -181.86, 120),
              style: { fill: "#10b981", stroke: "#047857", strokeWidth: 1.5 },
              export: createExportFlags(true, true, false),
              angle: 120,
              width: 30,
              height: 18,
              cornerRadius: 4,
              tabShape: "semicircular",
              label: "#2",
            } as DiscTabNode,
          ],
        } as RingNode,

        // 3. Top Ring (Purple)
        {
          id: "ring-top-blue",
          type: "ring",
          name: "Top Ring (Purple)",
          visible: true,
          locked: false,
          transform: createTransform(),
          innerRadius: 5,
          outerRadius: 200,
          rotation: 0,
          style: { fill: "#8b5cf6", stroke: "#6d28d9", strokeWidth: 1.5 },
          children: [
            // Solid trapezoid polygon
            {
              id: "top-solid-trapezoid",
              type: "trapezoid",
              name: "Solid Trapezoid",
              visible: true,
              locked: false,
              transform: createTransform(-120, -30),
              style: { fill: "#800000", stroke: "#ef4444", strokeWidth: 1.5 },
              export: createExportFlags(true, false, false),
              baseWidth: 50,
              topWidth: 35,
              height: 30,
            } as any,
            // Solid arc text
            {
              id: "top-solid-arc-text",
              type: "arcText",
              name: "Solid Arc Text",
              visible: true,
              locked: false,
              transform: createTransform(),
              style: { fill: "#ffffff" },
              export: createExportFlags(true, false, false),
              content: "Test number two",
              radius: 150,
              startAngle: -140,
              sweepAngle: 60,
              fontFamily: "Outfit, sans-serif",
              fontSize: 14,
            } as ArcTextNode,
            // Circle Window in Quadrant 1 (top-right)
            {
              id: "win-circle-q1",
              type: "window",
              name: "Circle Window Q1",
              visible: true,
              locked: false,
              transform: createTransform(120, -120),
              style: {},
              export: createExportFlags(false, true, false),
              shape: {
                id: "circle-shape-q1",
                type: "circle",
                visible: true,
                locked: false,
                transform: createTransform(),
                style: {},
                export: createExportFlags(false, true, false),
                radius: 40,
              } as CircleNode,
            } as WindowNode,
            // Window Text Object in Quadrant 3 (bottom-left, opposite quadrant)
            {
              id: "win-text-q3",
              type: "window",
              name: "Text Window Q3",
              visible: true,
              locked: false,
              transform: createTransform(-120, 120),
              style: {},
              export: createExportFlags(false, true, false),
              savedSolidType: "text",
              savedSolidStyle: { fill: "#cbd5e1" },
              shape: {
                id: "text-shape-q3",
                type: "text",
                name: "Text Shape Q3",
                visible: true,
                locked: false,
                transform: createTransform(),
                content: "TEST ONE",
                fontFamily: "Outfit, sans-serif",
                fontSize: 42,
                style: { fill: "transparent" },
                export: createExportFlags(false, true, false),
              } as any,
            } as WindowNode,
            // Attached Disc Tab on Top Ring (60 deg)
            {
              id: "tab-top-blue",
              type: "discTab",
              name: "Top Disc Tab",
              visible: true,
              locked: false,
              transform: createTransform(100, -173.2, 60),
              style: { fill: "#8b5cf6", stroke: "#6d28d9", strokeWidth: 1.5 },
              export: createExportFlags(true, true, false),
              angle: 60,
              width: 30,
              height: 18,
              cornerRadius: 4,
              tabShape: "semicircular",
              label: "#3",
            } as DiscTabNode,
          ],
        } as RingNode,
      ],
    },
  },
};

export const TEMPLATE_LIBRARY: Template[] = [
  BLANK_TEMPLATE,
  DIAGNOSTIC_3LAYER_TEMPLATE,
  ZODIAC_TEMPLATE,
  DECODER_TEMPLATE,
  GAME_TEMPLATE,
];
