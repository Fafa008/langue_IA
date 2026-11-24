import type { Metadata } from "next";
import LeconDetailView from "@/components/formateur/contenus/LeconDetailView";

export const metadata: Metadata = { title: "Leçon – Contenus pédagogiques – Digithèque" };

export default function LeconContenusPage({ params }: { params: { code: string; id: string } }) {
  return <LeconDetailView code={params.code} idLecon={params.id} />;
}
