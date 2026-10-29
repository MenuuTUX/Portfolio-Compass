import type { Metadata } from "next";
import LabApp from "@/components/lab/LabApp";

export const metadata: Metadata = {
  title: "Compass Lab",
  description: "Backtest allocation, trend and momentum strategies on past prices. Hypothetical results, not advice.",
  // The Lab is reached from Settings, not from search.
  robots: { index: false },
};

export default function LabPage() {
  return <LabApp />;
}
