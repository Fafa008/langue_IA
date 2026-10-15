import { ArrowRight, Globe } from "lucide-react";
import Link from "next/link";
import { pourcentage } from "@/lib/graphique";
import { ROUTES } from "@/lib/routes";
import type { ApprenantsParLangue } from "@/types/tableau-de-bord";
import CarteSection, { Squelette } from "./CarteSection";

interface RepartitionLanguesProps {
  langues: ApprenantsParLangue[] | undefined;
  totalApprenants: number | undefined;
}

/**
 * Apprenants par langue, en barres horizontales d'une seule couleur, de la plus suivie à la moins suivie.
 * Chaque barre porte son nombre et sa part : la lecture ne dépend jamais d'une nuance de couleur.
 */
export default function RepartitionLangues({ langues, totalApprenants }: RepartitionLanguesProps) {
  const triees = [...(langues ?? [])].sort((a, b) => b.apprenants - a.apprenants);
  const max = Math.max(1, ...triees.map((l) => l.apprenants));

  return (
    <CarteSection
      titre="Apprenants par langue"
      icon={Globe}
      action={
        <Link href={ROUTES.admin.langues} className="flex items-center gap-1 text-small font-semibold text-primary hover:underline">
          Gérer les langues <ArrowRight size={14} aria-hidden />
        </Link>
      }
    >
      {!langues || totalApprenants === undefined ? (
        <div className="space-y-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Squelette key={i} className="h-6" />
          ))}
        </div>
      ) : triees.length === 0 ? (
        <p className="py-8 text-center text-content-secondary">Aucun apprenant inscrit pour le moment.</p>
      ) : (
        <>
          <ul className="space-y-4">
            {triees.map(({ langue, apprenants }) => {
              const part = pourcentage(apprenants, totalApprenants);
              return (
                <li key={langue.idLangue}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-content">{langue.libelle}</span>
                    <span className="whitespace-nowrap text-content">
                      <span className="font-semibold">{apprenants}</span>
                      <span className="ml-2 inline-block w-10 text-right text-content-secondary">{part} %</span>
                    </span>
                  </div>
                  <div
                    role="meter"
                    aria-label={`${langue.libelle} : ${apprenants} apprenants, ${part} %`}
                    aria-valuenow={apprenants}
                    aria-valuemin={0}
                    aria-valuemax={totalApprenants}
                    className="mt-1.5 h-2.5 rounded-full bg-primary/10"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(apprenants / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </CarteSection>
  );
}
