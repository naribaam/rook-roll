export const dynamicParams = true;
export function generateStaticParams() { return []; }
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
