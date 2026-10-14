import type { Metadata } from "next";
import { Suspense } from "react";
import LanguesView from "@/components/admin/langues/LanguesView";

export const metadata: Metadata = { title: "Langues et niveaux – Digithèque" };

export default function LanguesPage() {
  // Les filtres sont lus dans l'URL (useSearchParams), ce qui demande une frontière Suspense
  return (
    <Suspense>
      <LanguesView />
    </Suspense>
  );
}
