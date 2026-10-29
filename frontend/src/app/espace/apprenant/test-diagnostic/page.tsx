import PlacementTest from "@/components/testDiagnostic/PlacementTest";
import { LANGUES } from "@/lib/languages";
import type { CodeLangue } from "@/types/langue";

const estCodeLangue = (v: unknown): v is CodeLangue => LANGUES.some((l) => l.code === v);

export default function DemarrageTestPage({ searchParams }: { searchParams: { langue?: string } }) {
  // Le profil n'expose pas encore de langue préférée ; le paramètre permet de présélectionner la langue.
  return <PlacementTest langueDemandee={estCodeLangue(searchParams.langue) ? searchParams.langue : undefined} />;
}
