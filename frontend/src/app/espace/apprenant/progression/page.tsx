"use client";

import ProgressionView from "@/components/apprenant/progression/ProgressionView";
import { useTestDiagnosticStore } from "@/store/test-diagnostic.store";

export default function ProgressionPage() {
  const resultat = useTestDiagnosticStore((s) => s.etat.resultat);
  return (
    <ProgressionView
      diagnostic={resultat ? { niveau: resultat.niveau, score: resultat.score, total: resultat.total } : null}
    />
  );
}
