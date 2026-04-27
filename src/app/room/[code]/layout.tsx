export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ code: "_" }];
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
