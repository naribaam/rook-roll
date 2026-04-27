import type { Metadata } from "next";
import Providers from "./providers";
import "../styles.css";

export const metadata: Metadata = {
  title: "Gambit — Play chess online, free",
  description:
    "Play live chess, train against an AI engine, climb the global ELO leaderboard and unlock premium boards.",
  openGraph: {
    title: "Gambit — Play chess online",
    description:
      "A modern chess platform with AI training, real-time multiplayer and a coin-based cosmetic store.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Gambit — Play chess online",
    description:
      "Rook & Roll is a full-featured web platform for playing chess, offering AI challenges and multiplayer matches.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
