import type { Metadata } from "next";
import NiveauxView from "@/components/admin/niveaux/NiveauxView";

export const metadata: Metadata = { title: "Langues et niveaux – Digithèque" };

export default function NiveauxPage() {
  return <NiveauxView />;
}
