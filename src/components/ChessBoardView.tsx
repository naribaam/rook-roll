import { Chessboard } from "react-chessboard";
import { boardColors, pieceFilterForSkin } from "@/lib/shop";
import type { CSSProperties } from "react";

type Props = {
  position: string; // FEN
  orientation?: "white" | "black";
  onPieceDrop?: (sourceSquare: string, targetSquare: string) => boolean;
  arrows?: { startSquare: string; endSquare: string; color: string }[];
  squareStyles?: Record<string, CSSProperties>;
  boardSkin?: string;
  pieceSkin?: string;
  allowDragging?: boolean;
};

export function ChessBoardView({
  position,
  orientation = "white",
  onPieceDrop,
  arrows = [],
  squareStyles = {},
  boardSkin = "classic",
  pieceSkin = "classic",
  allowDragging = true,
}: Props) {
  const colors = boardColors(boardSkin);
  const filter = pieceFilterForSkin(pieceSkin);
  return (
    <div
      className="rounded-2xl bg-card p-3 shadow-[var(--shadow-board)] ring-1 ring-border/60"
      style={{ width: "100%", ["--piece-filter" as string]: filter } as CSSProperties}
    >
      <style>{`
        [data-piece] svg, [data-piece] img { filter: var(--piece-filter, none); transition: filter .25s ease; }
      `}</style>
      <Chessboard
        options={{
          id: "main-board",
          position,
          boardOrientation: orientation,
          allowDragging,
          showAnimations: true,
          animationDurationInMs: 220,
          allowDrawingArrows: true,
          arrows,
          squareStyles,
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareStyle: { backgroundColor: colors.dark },
          boardStyle: {
            borderRadius: "0.75rem",
            overflow: "hidden",
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || !onPieceDrop) return false;
            return onPieceDrop(sourceSquare, targetSquare);
          },
        }}
      />
    </div>
  );
}