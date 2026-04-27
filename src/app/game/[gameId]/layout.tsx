export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ gameId: "_" }];
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
