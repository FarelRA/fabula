import { ValueScreen } from "@/components/onboarding/ValueScreen";

export default function Home() {
  const demo =
    process.env.NEXT_PUBLIC_FIXTURES === "1" || !process.env.NEXT_PUBLIC_CONVEX_URL;
  return <ValueScreen demo={demo} />;
}
