import type { Metadata } from "next";
import { Suspense } from "react";
import UtilisateursView from "@/components/admin/utilisateurs/UtilisateursView";

export const metadata: Metadata = { title: "Gestion des utilisateurs – Digithèque" };

export default function UtilisateursPage() {
  // Les filtres sont lus dans l'URL (useSearchParams), ce qui demande une frontière Suspense
  return (
    <Suspense>
      <UtilisateursView />
    </Suspense>
  );
}
