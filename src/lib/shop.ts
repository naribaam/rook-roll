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
 * Mapping piece skin id -> react-chessboard `pieces` style key.
 * react-chessboard ships several built-in piece sets we leverage here.
 */
export function piecesForSkin(skin: string): string {
  switch (skin) {
    case "neon":
      return "alpha";
    case "wooden":
      return "wikipedia";
    case "cyber":
      return "cburnett";
    case "minimal":
      return "alpha";
    default:
      return "wikipedia";
  }
}
