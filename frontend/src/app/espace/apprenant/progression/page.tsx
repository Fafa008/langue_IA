import type { Metadata } from "next";
import ProgressionView from "@/components/apprenant/progression/ProgressionView";

export const metadata: Metadata = { title: "Ma progression – Digithèque" };

export default function ProgressionPage() {
  return <ProgressionView />;
}
