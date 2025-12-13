// Neobrutalist pastel color palette
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
];

// Generate a deterministic color based on struct name
export function getStructColor(structName: string): string {
  let hash = 0;
  for (let i = 0; i < structName.length; i++) {
    hash = structName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_COLORS.length;
  return PASTEL_COLORS[index];
}

// Get a random pastel color
export function getRandomPastelColor(): string {
  return PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
}

// Solid colors for UI elements (no gradients)
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
  indigo: "#B39DDB",
  teal: "#80CBC4",
  lime: "#DCE775",
};
