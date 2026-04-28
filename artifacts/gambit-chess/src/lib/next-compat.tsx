import {
  Link as WouterLink,
  useLocation,
  useParams as useWouterParams,
} from "wouter";
import type { ComponentProps, ReactNode } from "react";

type LinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  children?: ReactNode;
};

export default function Link({ href, children, ...rest }: LinkProps) {
  return (
    <WouterLink href={href} asChild>
      <a {...rest}>{children}</a>
    </WouterLink>
  );
}

export function useRouter() {
  const [, navigate] = useLocation();
  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
    prefetch: (_path: string) => {},
  };
}

export function usePathname(): string {
  const [location] = useLocation();
  return location || "/";
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useWouterParams() as T;
}

export function useSearchParams() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  return new URLSearchParams(search);
}
