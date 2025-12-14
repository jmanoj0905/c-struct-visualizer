// Expanded neobrutalist pastel color palette (40 unique colors for struct types)
const PASTEL_COLORS = [
  "#FFB3BA", // Light pink
  "#FFDFBA", // Light peach
  "#FFFFBA", // Light yellow
  "#BAFFC9", // Light mint
  "#BAE1FF", // Light blue
  "#E0BBE4", // Light lavender
  "#FFDAC1", // Light apricot
  "#C7CEEA", // Light periwinkle
  "#B5EAD7", // Light seafoam
  "#FFE5D9", // Light rose
  "#FFDFD3", // Light coral
  "#E2F0CB", // Light lime
  "#FFC8DD", // Light magenta
  "#BDE0FE", // Sky blue
  "#A2D2FF", // Powder blue
  "#FFCCE5", // Cotton candy
  "#D4A5A5", // Dusty rose
  "#FFE4B5", // Moccasin
  "#E6E6FA", // Light lavender blue
  "#F0E68C", // Khaki
  "#DDA0DD", // Plum
  "#FFB6C1", // Light pink 2
  "#98D8C8", // Aquamarine
  "#FFD1DC", // Pastel pink
  "#C1E1C1", // Pastel green
  "#FADBD8", // Pastel rose
  "#FAD7A0", // Pastel orange
  "#D5F4E6", // Pastel mint
  "#AED6F1", // Pastel sky
  "#E8DAEF", // Pastel purple
  "#F9E79F", // Pastel yellow
  "#ABEBC6", // Pastel emerald
  "#F5B7B1", // Pastel salmon
  "#D2B4DE", // Pastel violet
  "#A9CCE3", // Pastel azure
  "#FAD7A0", // Pastel gold
  "#EDBB99", // Pastel tan
  "#D5DBDB", // Pastel gray
  "#F8BBD0", // Pastel rose pink
  "#B2DFDB", // Pastel teal
];

// Cache to track struct name to color index mapping
const structColorMap = new Map<string, number>();
let nextColorIndex = 0;

// Generate a unique color for each struct (no repeats until 40+ structs)
export function getStructColor(
  structName: string,
  allStructNames?: string[],
): string {
  // If we have the list of all structs, rebuild the mapping to ensure consistency
  if (allStructNames) {
    // Sort struct names alphabetically for consistent ordering
    const sortedNames = [...allStructNames].sort();

    // Clear and rebuild the map
    structColorMap.clear();
    sortedNames.forEach((name, index) => {
      structColorMap.set(name, index % PASTEL_COLORS.length);
    });

    // Update next color index
    nextColorIndex = sortedNames.length;
  }

  // If this struct already has a color assigned, return it
  if (structColorMap.has(structName)) {
    return PASTEL_COLORS[structColorMap.get(structName)!];
  }

  // Assign the next available color
  const colorIndex = nextColorIndex % PASTEL_COLORS.length;
  structColorMap.set(structName, colorIndex);
  nextColorIndex++;

  return PASTEL_COLORS[colorIndex];
}

// Get a random pastel color
export function getRandomPastelColor(): string {
  return PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
}

// Solid colors for UI elements (no gradients) - neobrutalism style
export const UI_COLORS = {
  pink: "#FFB3D9",
  purple: "#DDA0DD",
  yellow: "#FFF59D",
  orange: "#FFCC80",
  green: "#A5D6A7",
  emerald: "#81C784",
  blue: "#90CAF9",
  cyan: "#80DEEA",
  red: "#EF9A9A",
  redDelete: "#FFCDD2", // Reddish for delete button
  indigo: "#B39DDB",
  teal: "#80CBC4",
  lime: "#DCE775",
};
