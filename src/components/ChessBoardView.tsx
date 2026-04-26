import { Chessboard } from "react-chessboard";
import { boardColors } from "@/lib/shop";
import type { CSSProperties } from "react";

type Props = {
  position: string; // FEN
  orientation?: "white" | "black";
  onPieceDrop?: (sourceSquare: string, targetSquare: string) => boolean;
  arrows?: { startSquare: string; endSquare: string; color: string }[];
  squareStyles?: Record<string, CSSProperties>;
  boardSkin?: string;
  allowDragging?: boolean;
};

export function ChessBoardView({
  position,
  orientation = "white",
  onPieceDrop,
  arrows = [],
  squareStyles = {},
  boardSkin = "classic",
  allowDragging = true,
}: Props) {
  const colors = boardColors(boardSkin);
  return (
    <div
      className="rounded-2xl bg-card p-3 shadow-[var(--shadow-board)]"
      style={{ width: "100%" }}
    >
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