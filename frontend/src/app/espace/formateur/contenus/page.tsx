import type { Metadata } from "next";
import LanguesContenusView from "@/components/formateur/contenus/LanguesContenusView";

export const metadata: Metadata = { title: "Contenus pédagogiques – Digithèque" };

export default function ContenusPage() {
  return <LanguesContenusView />;
}
