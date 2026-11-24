import type { Metadata } from "next";
import LangueContenusView from "@/components/formateur/contenus/LangueContenusView";

export const metadata: Metadata = { title: "Contenus pédagogiques – Digithèque" };

interface Props {
  params: { code: string };
  searchParams: { onglet?: string };
}

export default function LangueContenusPage({ params, searchParams }: Props) {
  return <LangueContenusView code={params.code} ongletInitial={searchParams.onglet} />;
}
