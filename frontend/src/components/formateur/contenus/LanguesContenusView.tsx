"use client";
import { FolderCog, Loader2 } from "lucide-react";
import Link from "next/link";
import LangueFlag from "@/components/admin/langues/LangueFlag";
import Alert from "@/components/ui/Alert";
import { useLanguesContenus } from "@/hooks/useContenus";
import { ROUTES } from "@/lib/routes";
import { BadgeDonneesSimulees } from "./communs";

const COMPTEURS = [
  { cle: "modules", label: "Modules" },
  { cle: "lecons", label: "Leçons" },
  { cle: "activites", label: "Activités" },
  { cle: "parcours", label: "Parcours" },
] as const;

/** Rubrique « Contenus » : les six langues du centre, leurs niveaux et le nombre de contenus de chacune. */
export default function LanguesContenusView() {
  const langues = useLanguesContenus();

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6">
        <p className="eyebrow">Espace formateur</p>
        <h1 className="mt-2">Contenus pédagogiques</h1>
        <p className="mt-2 max-w-3xl text-content-secondary">Modules, leçons, exercices et parcours, langue par langue.</p>
        <div className="mt-3">
          <BadgeDonneesSimulees />
        </div>
      </header>

      <section aria-label="Langues" aria-busy={langues.isFetching} className="card p-0">
        {langues.isError ? (
          <div className="p-6">
            <Alert>Les langues n&apos;ont pas pu être chargées. Réessayez.</Alert>
          </div>
        ) : !langues.data ? (
          <div className="flex justify-center py-20 text-content-secondary">
            <Loader2 className="animate-spin" aria-label="Chargement des langues" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left">
              <caption className="sr-only">Langues et nombre de contenus</caption>
              <thead>
                <tr className="border-b border-border">
                  {["Langue", "Niveaux", ...COMPTEURS.map((c) => c.label)].map((c) => (
                    <th key={c} scope="col" className="whitespace-nowrap px-5 py-4 font-semibold text-content">
                      {c}
                    </th>
                  ))}
                  <th scope="col" className="px-5 py-4 text-center font-semibold text-content">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {langues.data.map((l) => (
                  <tr key={l.code} className="border-b border-border last:border-0 hover:bg-background/60">
                    <th scope="row" className="px-5 py-4 text-left font-normal">
                      <div className="flex items-center gap-3">
                        <LangueFlag code={l.code} />
                        <span className="whitespace-nowrap font-medium text-content">{l.libelle}</span>
                      </div>
                    </th>
                    <td className="px-5 py-4">
                      {l.niveaux.length === 0 ? (
                        <span className="text-content-secondary">Aucun niveau</span>
                      ) : (
                        <ul aria-label={`Niveaux de ${l.libelle}`} className="flex max-w-xs flex-wrap gap-1.5">
                          {l.niveaux.map((n) => (
                            <li key={n.id} className="rounded-full bg-primary/5 px-2.5 py-0.5 text-small font-medium text-primary ring-1 ring-inset ring-primary/15">
                              {n.code}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    {COMPTEURS.map((c) => (
                      <td key={c.cle} className="px-5 py-4 text-content">
                        {l.compteurs[c.cle]}
                      </td>
                    ))}
                    <td className="px-5 py-4 text-center">
                      <Link
                        href={ROUTES.formateur.contenus.langue(l.code)}
                        aria-label={`Gérer les contenus : ${l.libelle}`}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-small font-medium text-content hover:border-primary/40 hover:bg-background hover:text-primary"
                      >
                        <FolderCog size={16} aria-hidden />
                        Gérer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
