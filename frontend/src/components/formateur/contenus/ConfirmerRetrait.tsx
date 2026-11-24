"use client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useRetirerContenu } from "@/hooks/useContenus";
import { NOMS_ENTITE, accorder, ceNom, leNom, libelleEntite, majuscule } from "@/lib/contenus/libelles";
import type { ContenusLangue, Entite, TypeEntite } from "@/lib/contenus/types";
import { utilisation, type ActionRetrait } from "@/lib/contenus/validation";
import { messageErreur } from "./panels/PanneauFormulaire";

interface ConfirmerRetraitProps {
  action: ActionRetrait;
  type: TypeEntite;
  entite: Entite;
  ctx: ContenusLangue;
  onClose: () => void;
  onDone: () => void;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Pourquoi l'élément ne peut qu'être archivé : « est utilisé dans 1 parcours », « contient 8 leçons ». */
function raisonUtilisation(type: TypeEntite, u: ReturnType<typeof utilisation>): string | null {
  const raisons: string[] = [];
  // « parcours » est invariable
  if (u.parcours.length > 0) raisons.push(`est ${accorder(type, "utilisé")} dans ${u.parcours.length} parcours`);
  if (u.enfants > 0) raisons.push(`contient ${pluriel(u.enfants, type === "module" ? "leçon" : "activité")}`);
  return raisons.length > 0 ? raisons.join(" et ") : null;
}

/** Confirmation obligatoire avant d'archiver ou de supprimer (RG-GP-08, RG-GP-09). */
export default function ConfirmerRetrait({ action, type, entite, ctx, onClose, onDone }: ConfirmerRetraitProps) {
  const retirer = useRetirerContenu();
  const nom = `${majuscule(leNom(type))} « ${libelleEntite(type, entite)} »`;
  const raison = raisonUtilisation(type, utilisation(type, entite.id, ctx));
  const pronom = NOMS_ENTITE[type].feminin ? "Elle" : "Il";
  const suite = `${pronom} ne pourra plus être ${accorder(type, "ajouté")} à un parcours ni ${accorder(type, "modifié")}.`;

  const description =
    action === "supprimer"
      ? `${nom} sera définitivement ${accorder(type, "supprimé")}. Cette action est irréversible.`
      : raison
        ? `${nom} ${raison} : ${pronom.toLowerCase()} sera ${accorder(type, "archivé")}, pas ${accorder(type, "supprimé")}. ${suite}`
        : `${nom} sera ${accorder(type, "archivé")}. ${suite}`;

  return (
    <ConfirmDialog
      title={`${action === "supprimer" ? "Supprimer" : "Archiver"} ${ceNom(type)} ?`}
      description={description}
      confirmLabel={action === "supprimer" ? "Supprimer" : "Archiver"}
      onConfirm={() => retirer.mutate({ action, type, entite }, { onSuccess: onDone })}
      onClose={onClose}
      pending={retirer.isPending}
      error={retirer.isError ? messageErreur(retirer.error) : null}
    />
  );
}
