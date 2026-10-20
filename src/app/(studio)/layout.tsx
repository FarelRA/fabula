import { AppShell } from "@/components/shell/AppShell";

/** Public studio chrome: brand, rooms, search and utility controls. */
export default function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
