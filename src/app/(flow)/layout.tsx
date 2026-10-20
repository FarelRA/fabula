import { BareShell } from "@/components/shell/BareShell";

/**
 * Focused casting flows keep the utilities but drop the full studio nav:
 * every page here is already a guided step with its own back link.
 */
export default function FlowLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <BareShell>{children}</BareShell>;
}
