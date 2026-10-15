import { Globe } from "lucide-react";
import type { ReactNode } from "react";
import OngletsLanguesNiveaux from "@/components/admin/OngletsLanguesNiveaux";

/**
 * Langues et niveaux réunis sur une même page, un onglet chacun.
 * Chaque onglet garde son adresse (/admin/langues, /admin/niveaux) et ses propres filtres dans l'URL.
 */
export default function LanguesNiveauxLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-start gap-4">
          <Globe size={36} className="mt-1 shrink-0 text-primary" aria-hidden />
          <div>
            <h1>Gestion des langues et niveaux</h1>
            <p className="mt-1 text-base text-content-secondary">
              Configurez les langues proposées et les niveaux d&apos;apprentissage de la plateforme.
            </p>
          </div>
        </div>
        <OngletsLanguesNiveaux />
      </div>
      {children}
    </>
  );
}
