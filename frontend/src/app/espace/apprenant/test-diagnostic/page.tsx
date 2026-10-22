import type { Metadata } from "next";
import PlacementTest from "@/components/testDiagnostic/PlacementTest";
import { LANGUES } from "@/lib/languages";
import type { CodeLangue } from "@/types/langue";

export const metadata: Metadata = { title: "Test de positionnement – Digithèque" };

const estCodeLangue = (v: unknown): v is CodeLangue => LANGUES.some((l) => l.code === v);

export default function TestDiagnosticPage({ searchParams }: { searchParams: { langue?: string } }) {
  // Le profil n'expose pas encore de langue préférée ; le paramètre permet de présélectionner la langue.
  const langueInitiale: CodeLangue = estCodeLangue(searchParams.langue) ? searchParams.langue : "en";

  return (
    <main className="container-page py-10 md:py-14">
      <PlacementTest langueInitiale={langueInitiale} />
    </main>
  );
}