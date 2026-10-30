import PlacementTest from "@/components/testDiagnostic/PlacementTest";

export default function DemarrageTestPage({ searchParams }: { searchParams: { langue?: string } }) {
  // ?langue=en présélectionne la langue, si l'API la propose et qu'elle est disponible
  return <PlacementTest langueDemandee={searchParams.langue} />;
}
