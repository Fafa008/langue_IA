import type { Metadata } from "next";
import SyntheseErreursView from "@/components/formateur/synthese/SyntheseErreursView";

export const metadata: Metadata = { title: "Synthèse des erreurs – Digithèque" };

export default function SyntheseErreursPage() {
  return <SyntheseErreursView />;
}
