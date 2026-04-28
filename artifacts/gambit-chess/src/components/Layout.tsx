import { Header } from "./Header";
import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
        {children}
      </main>
    </div>
  );
}
