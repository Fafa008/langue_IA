import { GraduationCap, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { ROLE_LABELS } from "@/lib/roles";
import { COMPTES_DEMO } from "@/mocks/comptes-demo";
import type { Role } from "@/types/utilisateur";

const ICONES: Record<Role, LucideIcon> = {
  APPRENANT: UserRound,
  FORMATEUR: GraduationCap,
  ADMINISTRATEUR: ShieldCheck,
};

/** Raccourcis de connexion, affichés seulement en mode simulé (NEXT_PUBLIC_API_MOCK=true). */
export default function ComptesDemo({ onChoisir }: { onChoisir: (email: string, motDePasse: string) => void }) {
  return (
    <section aria-labelledby="comptes-demo" className="mt-6 rounded-btn border border-dashed border-primary/30 bg-primary/5 p-4">
      <h2 id="comptes-demo" className="text-small font-semibold uppercase tracking-widest text-primary">
        Comptes de démonstration
      </h2>
      <p className="mt-1 text-small text-content-secondary">
        Mode simulé : choisissez un rôle pour remplir le formulaire.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {Object.entries(COMPTES_DEMO).map(([role, { utilisateur, motDePasse }]) => {
          const Icone = ICONES[role as Role];
          return (
            <button
              key={role}
              type="button"
              onClick={() => onChoisir(utilisateur.email, motDePasse)}
              title={utilisateur.email}
              className="flex flex-col items-center gap-1 rounded-btn border border-border bg-surface px-2 py-2.5 text-small font-medium text-content transition-colors hover:border-primary hover:text-primary"
            >
              <Icone size={18} aria-hidden />
              {ROLE_LABELS[role as Role]}
            </button>
          );
        })}
      </div>
    </section>
  );
}
