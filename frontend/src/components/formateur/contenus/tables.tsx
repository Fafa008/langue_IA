import { Archive, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import ActionsLigne, { type Action } from "@/components/ui/ActionsLigne";
import { LIBELLES_COMPETENCE, LIBELLES_TYPE_ACTIVITE, extrait, libelleEntite } from "@/lib/contenus/libelles";
import type { Activite, ContenusLangue, Entite, Lecon, Module, Parcours, TypeEntite } from "@/lib/contenus/types";
import { phaseAssimil, retraitsPossibles, type ActionRetrait } from "@/lib/contenus/validation";
import { ROUTES } from "@/lib/routes";
import { DerniereModification, StatutContenuBadge } from "./communs";

export type ActionLigneContenu = "modifier" | ActionRetrait;

interface TableProps<E extends Entite> {
  items: E[];
  ctx: ContenusLangue;
  onAction: (action: ActionLigneContenu, entite: E) => void;
}

/** Sans retour à la ligne : à côté du panneau ouvert, le tableau défile horizontalement au lieu de s'écraser. */
const cellule = "whitespace-nowrap px-5 py-4 align-top";

function Table({ legende, colonnes, children }: { legende: string; colonnes: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-left">
        <caption className="sr-only">{legende}</caption>
        <thead>
          <tr className="border-b border-border">
            {colonnes.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap px-5 py-4 font-semibold text-content">
                {c}
              </th>
            ))}
            <th scope="col" className="px-5 py-4 text-center font-semibold text-content">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const ligne = "border-b border-border last:border-0 hover:bg-background/60";

/** Modifier (sauf archivé), Archiver (sauf archivé), Supprimer (si non utilisé : RG-GP-08, RG-GP-09). */
function Actions<E extends Entite>({ type, entite, ctx, onAction }: { type: TypeEntite; entite: E; ctx: ContenusLangue; onAction: TableProps<E>["onAction"] }) {
  const retraits = retraitsPossibles(type, entite, ctx);
  const actions: Action[] = [
    {
      label: "Modifier",
      icon: Pencil,
      onSelect: () => onAction("modifier", entite),
      disabled: entite.statut === "ARCHIVE",
      title: "Un élément archivé ne se modifie plus.",
    },
  ];
  if (retraits.includes("archiver")) actions.push({ label: "Archiver", icon: Archive, onSelect: () => onAction("archiver", entite) });
  if (retraits.includes("supprimer")) actions.push({ label: "Supprimer", icon: Trash2, danger: true, onSelect: () => onAction("supprimer", entite) });
  return <ActionsLigne label={`Actions pour « ${libelleEntite(type, entite)} »`} actions={actions} />;
}

const niveauCode = (ctx: ContenusLangue, idNiveau: string) => ctx.langue.niveaux.find((n) => n.id === idNiveau)?.code ?? "—";

export function ModulesTable({ items, ctx, onAction }: TableProps<Module>) {
  return (
    <Table legende={`Modules – ${ctx.langue.libelle}`} colonnes={["N°", "Titre", "Leçons", "Statut", "Dernière modification"]}>
      {items.map((m) => (
        <tr key={m.id} className={ligne}>
          <td className={`${cellule} font-semibold text-primary`}>{m.ordre}</td>
          <td className={`${cellule} font-medium text-content`}>{m.titre}</td>
          <td className={cellule}>{ctx.lecons.filter((l) => l.idModule === m.id).length}</td>
          <td className={cellule}>
            <StatutContenuBadge statut={m.statut} />
          </td>
          <td className={cellule}>
            <DerniereModification trace={m} />
          </td>
          <td className={cellule}>
            <Actions type="module" entite={m} ctx={ctx} onAction={onAction} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

export function LeconsTable({ items, ctx, onAction }: TableProps<Lecon>) {
  return (
    <Table legende={`Leçons – ${ctx.langue.libelle}`} colonnes={["N°", "Titre", "Module", "Niveau", "Phase", "Activités", "Statut", "Dernière modification"]}>
      {items.map((l) => (
        <tr key={l.id} className={ligne}>
          <td className={`${cellule} font-semibold text-primary`}>{l.ordre}</td>
          <td className={cellule}>
            <Link href={ROUTES.formateur.contenus.lecon(ctx.langue.code, l.id)} className="font-medium text-primary underline-offset-2 hover:underline">
              {l.titre}
            </Link>
          </td>
          <td className={cellule}>{ctx.modules.find((m) => m.id === l.idModule)?.titre ?? "—"}</td>
          <td className={cellule}>{niveauCode(ctx, l.idNiveau)}</td>
          <td className={cellule}>{phaseAssimil(l.ordre) === "active" ? "Active" : "Passive"}</td>
          <td className={cellule}>{ctx.activites.filter((a) => a.idLecon === l.id).length}</td>
          <td className={cellule}>
            <StatutContenuBadge statut={l.statut} />
          </td>
          <td className={cellule}>
            <DerniereModification trace={l} />
          </td>
          <td className={cellule}>
            <Actions type="lecon" entite={l} ctx={ctx} onAction={onAction} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

export function ActivitesTable({ items, ctx, onAction, avecLecon = true }: TableProps<Activite> & { avecLecon?: boolean }) {
  const colonnes = [...(avecLecon ? ["Leçon"] : []), "Type", "Compétence", "Difficulté", "Consigne", "Statut", "Dernière modification"];
  return (
    <Table legende={`Activités – ${ctx.langue.libelle}`} colonnes={colonnes}>
      {items.map((a) => {
        const lecon = ctx.lecons.find((l) => l.id === a.idLecon);
        return (
          <tr key={a.id} className={ligne}>
            {avecLecon && (
              <td className={`${cellule} whitespace-nowrap`}>
                {lecon ? (
                  <Link href={ROUTES.formateur.contenus.lecon(ctx.langue.code, lecon.id)} className="text-primary underline-offset-2 hover:underline">
                    {lecon.ordre}. {lecon.titre}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
            )}
            <td className={`${cellule} whitespace-nowrap font-medium text-content`}>{LIBELLES_TYPE_ACTIVITE[a.type]}</td>
            <td className={cellule}>{LIBELLES_COMPETENCE[a.competence]}</td>
            <td className={cellule}>
              <span className="sr-only">Difficulté </span>
              {a.difficulte}
              <span className="text-content-secondary"> / 5</span>
            </td>
            <td className={`${cellule} min-w-[14rem] max-w-xs !whitespace-normal text-content-secondary`}>{extrait(a.consigne)}</td>
            <td className={cellule}>
              <StatutContenuBadge statut={a.statut} />
            </td>
            <td className={cellule}>
              <DerniereModification trace={a} />
            </td>
            <td className={cellule}>
              <Actions type="activite" entite={a} ctx={ctx} onAction={onAction} />
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

export function ParcoursTable({ items, ctx, onAction }: TableProps<Parcours>) {
  return (
    <Table legende={`Parcours – ${ctx.langue.libelle}`} colonnes={["Titre", "Niveau cible", "Éléments", "Statut", "Dernière modification"]}>
      {items.map((p) => (
        <tr key={p.id} className={ligne}>
          <td className={`${cellule} font-medium text-content`}>{p.titre}</td>
          <td className={cellule}>{niveauCode(ctx, p.idNiveauCible)}</td>
          <td className={cellule}>{p.elements.length}</td>
          <td className={cellule}>
            <StatutContenuBadge statut={p.statut} />
          </td>
          <td className={cellule}>
            <DerniereModification trace={p} />
          </td>
          <td className={cellule}>
            <Actions type="parcours" entite={p} ctx={ctx} onAction={onAction} />
          </td>
        </tr>
      ))}
    </Table>
  );
}
