import type { Metadata } from "next";
import { Suspense } from "react";
import FormateursView from "@/components/admin/formateurs/FormateursView";

export const metadata: Metadata = { title: "Gestion des formateurs – Digithèque" };

export default function FormateursPage() {
  // Les filtres sont lus dans l'URL (useSearchParams), ce qui demande une frontière Suspense
  return (
    <Suspense>
      <FormateursView />
    </Suspense>
  );
}
