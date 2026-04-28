export type ShopItem = {
  id: string;
  name: string;
  price: number;
  type: "piece_skin" | "board_skin";
  preview: string; // emoji or short label for visual hint
  description: string;
};

export const PIECE_SKINS: ShopItem[] = [
  {
    id: "classic",
    name: "Classic",
    price: 0,
    type: "piece_skin",
    preview: "♛",
    description: "Timeless Staunton design. Free for everyone.",
  },
  {
    id: "neon",
    name: "Neon",
    price: 500,
    type: "piece_skin",
    preview: "✦",
    description: "Electric neon outlines. Stand out on the board.",
  },
  {
    id: "wooden",
    name: "Wooden",
    price: 500,
    type: "piece_skin",
    preview: "♜",
    description: "Hand-carved walnut feel. Classic tournament look.",
  },
  {
    id: "cyber",
    name: "Cyber",
    price: 500,
    type: "piece_skin",
    preview: "▲",
    description: "Futuristic geometric pieces from 2099.",
  },
  {
    id: "minimal",
    name: "Minimal",
    price: 500,
    type: "piece_skin",
    preview: "◆",
    description: "Clean shapes for distraction-free play.",
  },
];

export const BOARD_SKINS: ShopItem[] = [
  {
    id: "classic",
    name: "Classic",
    price: 0,
    type: "board_skin",
    preview: "▦",
    description: "Standard cream & green. Free.",
  },
  {
    id: "wood",
    name: "Wood",
    price: 1000,
    type: "board_skin",
    preview: "🟫",
    description: "Premium walnut and maple finish.",
  },
  {
    id: "marble",
    name: "Marble",
    price: 1000,
    type: "board_skin",
    preview: "⬜",
    description: "Cold marble luxury for serious players.",
  },
  {
    id: "neon",
    name: "Neon",
    price: 1000,
    type: "board_skin",
    preview: "🟪",
    description: "Cyberpunk arena vibes.",
  },
  {
    id: "glass",
    name: "Glass",
    price: 1000,
    type: "board_skin",
    preview: "🟦",
    description: "Crystal-clear futuristic glass tiles.",
  },
  {
    id: "dark",
    name: "Midnight",
    price: 800,
    type: "board_skin",
    preview: "⬛",
    description: "Deep dark theme — easy on the eyes.",
  },
  {
    id: "pastel",
    name: "Pastel",
    price: 800,
    type: "board_skin",
    preview: "🌸",
    description: "Soft pastel pinks for a calm vibe.",
  },
];

export function boardColors(skin: string): { light: string; dark: string } {
  switch (skin) {
    case "wood":
      return {
        light: "var(--board-light-wood)",
        dark: "var(--board-dark-wood)",
      };
    case "marble":
      return {
        light: "var(--board-light-marble)",
        dark: "var(--board-dark-marble)",
      };
    case "neon":
      return {
        light: "var(--board-light-neon)",
        dark: "var(--board-dark-neon)",
      };
    case "glass":
      return {
        light: "var(--board-light-glass)",
        dark: "var(--board-dark-glass)",
      };
    case "dark":
      return {
        light: "var(--board-light-dark)",
        dark: "var(--board-dark-dark)",
      };
    case "pastel":
      return {
        light: "var(--board-light-pastel)",
        dark: "var(--board-dark-pastel)",
      };
    default:
      return { light: "var(--board-light)", dark: "var(--board-dark)" };
  }
}

/**
 * CSS filter applied to the chess pieces to visually differentiate skins.
 * react-chessboard ships a single SVG piece set, so we restyle it via filters.
 */
export function pieceFilterForSkin(skin: string): string {
  switch (skin) {
    case "neon":
      return "drop-shadow(0 0 6px oklch(0.78 0.2 300)) hue-rotate(260deg) saturate(1.6)";
    case "wooden":
      return "sepia(0.7) saturate(1.4) hue-rotate(-10deg) brightness(0.95)";
    case "cyber":
      return "hue-rotate(160deg) saturate(1.4) contrast(1.15) drop-shadow(0 0 4px oklch(0.7 0.18 200))";
    case "minimal":
      return "grayscale(1) contrast(1.1)";
    default:
      return "none";
  }
}
