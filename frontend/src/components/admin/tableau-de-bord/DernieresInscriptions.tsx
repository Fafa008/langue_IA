import { ArrowRight, UserPlus } from "lucide-react";
import Link from "next/link";
import StatutBadge from "@/components/admin/StatutBadge";
import Avatar from "@/components/ui/Avatar";
import { formatDateCourte } from "@/lib/date";
import { STATUT_ABONNEMENT_LABELS } from "@/lib/roles";
import { ROUTES } from "@/lib/routes";
import type { Abonnement } from "@/types/abonnement";
import type { LangueGeree } from "@/types/langue";
import type { InscriptionApprenant } from "@/types/tableau-de-bord";
import CarteSection, { Squelette } from "./CarteSection";

const COLONNES = ["Apprenant", "Langues", "Abonnement", "Inscription", "Statut du compte"];

/** Au-delà, les langues sont résumées par « +n » (liste complète au survol). */
const LANGUES_VISIBLES = 2;

function CelluleLangues({ langues: liste }: { langues: LangueGeree[] }) {
  if (liste.length === 0) return <span className="text-content-secondary">Non choisie</span>;

  const langues = liste.map((l) => l.libelle);
  const reste = langues.length - LANGUES_VISIBLES;
  return (
    <span className="whitespace-nowrap text-content" title={reste > 0 ? langues.join(", ") : undefined}>
      {langues.slice(0, LANGUES_VISIBLES).join(", ")}
      {reste > 0 && (
        <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-small font-semibold text-primary">
          +{reste}
          <span className="sr-only"> : {langues.slice(LANGUES_VISIBLES).join(", ")}</span>
        </span>
      )}
    </span>
  );
}

/** Formule souscrite et statut de l'abonnement (StatutAbonnement). */
function CelluleAbonnement({ abonnement }: { abonnement: Abonnement | null }) {
  if (!abonnement) return <span className="text-content-secondary">Aucun abonnement</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="block font-medium text-content">{abonnement.formule.libelle}</span>
      <span className="block text-small text-content-secondary">{STATUT_ABONNEMENT_LABELS[abonnement.statut]}</span>
    </span>
  );
}

/** Les cinq derniers apprenants inscrits, avec un lien vers la liste complète des apprenants. */
export default function DernieresInscriptions({ inscriptions }: { inscriptions: InscriptionApprenant[] | undefined }) {
  return (
    <CarteSection
      titre="Dernières inscriptions"
      icon={UserPlus}
      action={
        <Link
          href={`${ROUTES.admin.utilisateurs}?role=APPRENANT`}
          className="flex items-center gap-1 text-small font-semibold text-primary hover:underline"
        >
          Voir tous les apprenants <ArrowRight size={14} aria-hidden />
        </Link>
      }
      className="[&>div]:p-0"
    >
      {inscriptions && inscriptions.length === 0 ? (
        <p className="px-6 py-12 text-center text-content-secondary">Aucun apprenant inscrit pour le moment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left">
            <thead>
              <tr className="border-b border-border bg-background/60">
                {COLONNES.map((c) => (
                  <th key={c} scope="col" className="whitespace-nowrap px-6 py-3 text-small font-semibold text-content-secondary">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!inscriptions
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td colSpan={COLONNES.length} className="px-6 py-4">
                        <Squelette className="h-8" />
                      </td>
                    </tr>
                  ))
                : inscriptions.map(({ apprenant: a, langues, abonnement }) => (
                    <tr key={a.idUser} className="border-b border-border last:border-0 hover:bg-background/60">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar prenom={a.prenom} nom={a.nom} photoUrl={a.photoUrl} size={36} />
                          <div className="min-w-0">
                            <p className="whitespace-nowrap font-semibold text-content">
                              {a.prenom} {a.nom}
                            </p>
                            <p className="text-small text-content-secondary">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <CelluleLangues langues={langues} />
                      </td>
                      <td className="px-6 py-3">
                        <CelluleAbonnement abonnement={abonnement} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-content">{formatDateCourte(a.dateInscription)}</td>
                      <td className="px-6 py-3">
                        <StatutBadge statut={a.statut} />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </CarteSection>
  );
}
