import { BareShell } from "@/components/shell/BareShell";

/**
 * Stage surfaces own their furniture: one scene bar, no marketing nav or footer.
 */
export default function StageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <BareShell>{children}</BareShell>;
}
