import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      {
        name: "description",
        content:
          "Play chess online, climb the leaderboard, train against AI and earn coins to unlock premium boards and pieces.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      {
        property: "og:description",
        content:
          "Multiplayer chess, AI training, ELO ratings and a coin-driven cosmetic store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "description", content: "Rook & Roll is a full-featured web platform for playing chess, offering AI challenges and multiplayer matches." },
      { property: "og:description", content: "Rook & Roll is a full-featured web platform for playing chess, offering AI challenges and multiplayer matches." },
      { name: "twitter:description", content: "Rook & Roll is a full-featured web platform for playing chess, offering AI challenges and multiplayer matches." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fcd8604a-09f8-4d41-a6b0-eb7194893ae8/id-preview-133e4132--baf1a1bb-2a50-4ff3-8add-03cf3d1ce96e.lovable.app-1777214080274.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fcd8604a-09f8-4d41-a6b0-eb7194893ae8/id-preview-133e4132--baf1a1bb-2a50-4ff3-8add-03cf3d1ce96e.lovable.app-1777214080274.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
