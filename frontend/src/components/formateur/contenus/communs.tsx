"use client";
import type { LucideIcon } from "lucide-react";
import { useCallback, useRef, type ReactNode, type TextareaHTMLAttributes } from "react";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import FormField from "@/components/ui/FormField";
import { LIBELLES_STATUT } from "@/lib/contenus/libelles";
import type { Statut, Tracabilite } from "@/lib/contenus/types";
import { statutsAccessibles } from "@/lib/contenus/validation";
import { formatDateCourte } from "@/lib/date";

/** Étiquette visible sur chaque écran de la rubrique : aucune donnée ne vient du backend. */
export function BadgeDonneesSimulees() {
  return (
    <p role="note" data-testid="donnees-simulees" className="inline-block rounded-full bg-warning/15 px-3 py-1 text-small font-semibold text-warning-dark">
      Données simulées
    </p>
  );
}

const STYLES_STATUT: Record<Statut, { tone: "soft" | "muted"; dot: string }> = {
  BROUILLON: { tone: "muted", dot: "border-2 border-content-secondary bg-transparent" },
  PUBLIE: { tone: "soft", dot: "bg-primary" },
  ARCHIVE: { tone: "muted", dot: "bg-content-secondary" },
};

export function StatutContenuBadge({ statut }: { statut: Statut }) {
  const { tone, dot } = STYLES_STATUT[statut];
  return (
    <Badge tone={tone} dot={dot}>
      {LIBELLES_STATUT[statut]}
    </Badge>
  );
}

/** RG-GP-10 : date et auteur de la dernière modification. */
export function DerniereModification({ trace }: { trace: Tracabilite }) {
  return (
    <div className="whitespace-nowrap">
      <span className="text-content">{formatDateCourte(trace.modifieLe)}</span>
      <span className="block text-small text-content-secondary">{trace.modifiePar}</span>
    </div>
  );
}

export function EtatVide({ icon: Icon, titre, children }: { icon: LucideIcon; titre: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center text-content-secondary">
      <Icon size={36} className="text-primary" aria-hidden />
      <p className="mt-3 font-medium text-content">{titre}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

/**
 * Retour du focus à la fermeture d'un panneau ou d'une confirmation : sur le bouton qui l'a ouvert,
 * ou, s'il a disparu (ligne supprimée), sur l'élément de repli.
 */
export function useRetourFocus() {
  const declencheur = useRef<HTMLElement | null>(null);
  const memoriser = useCallback(() => {
    declencheur.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);
  const restaurer = useCallback((repli?: HTMLElement | null) => {
    const cible = declencheur.current;
    declencheur.current = null;
    requestAnimationFrame(() => {
      if (cible?.isConnected && !cible.matches(":disabled")) cible.focus();
      else repli?.focus();
    });
  }, []);
  return { memoriser, restaurer };
}

type ZoneTexteProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & { id: string; invalid: boolean };

export function ZoneTexte({ invalid, className = "", ...props }: ZoneTexteProps) {
  return <textarea {...props} aria-invalid={invalid} rows={props.rows ?? 3} className={`input resize-y ${invalid ? "input-error" : ""} ${className}`} />;
}

/** Statut proposé selon le cycle Brouillon → Publié → Archivé (l'archivage passe par l'action « Archiver »). */
export function ChampStatut({
  id,
  value,
  actuel,
  error,
  onChange,
}: {
  id: string;
  value: Statut;
  actuel: Statut | null;
  error?: string;
  onChange: (statut: Statut) => void;
}) {
  const options = statutsAccessibles(actuel).map((s) => ({ value: s, label: LIBELLES_STATUT[s] }));
  return (
    <FormField id={id} label="Statut *" error={error} hint="Cycle de vie : Brouillon, puis Publié, puis Archivé.">
      {(field) => <Select {...field} value={value} options={options} onChange={(e) => onChange(e.target.value as Statut)} />}
    </FormField>
  );
}
