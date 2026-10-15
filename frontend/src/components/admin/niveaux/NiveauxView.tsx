"use client";
import { Info, Loader2, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import { useNiveaux, useSupprimerNiveau } from "@/hooks/useNiveaux";
import { HTTP_STATUS, getErrorMessage } from "@/lib/api-client";
import type { Niveau } from "@/types/langue";
import NiveauPanel from "./NiveauPanel";
import NiveauxTable, { type ActionNiveau } from "./NiveauxTable";

type ActionEnCours = { type: "ajouter" } | { type: ActionNiveau; niveau: Niveau } | null;

const ERREURS_SUPPRESSION = {
  [HTTP_STATUS.CONFLICT]: "Ce niveau est utilisé par des tests, des parcours ou des exercices : il ne peut pas être supprimé.",
};

/** Onglet « Niveaux » : niveaux d'apprentissage (ajout, modification, suppression), ouverts ensuite langue par langue. */
export default function NiveauxView() {
  const liste = useNiveaux();
  const supprimer = useSupprimerNiveau();
  const [action, setAction] = useState<ActionEnCours>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fermerToast = useCallback(() => setToast(null), []);
  const fermer = useCallback(() => setAction(null), []);

  function ouvrir(next: ActionEnCours) {
    supprimer.reset();
    setAction(next);
  }

  function confirmer(message: string) {
    setAction(null);
    setToast(message);
  }

  const panneauOuvert = action?.type === "ajouter" || action?.type === "modifier";

  return (
    <div className={`mx-auto max-w-7xl ${panneauOuvert ? "lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6" : ""}`}>
      {toast && <Toast onClose={fermerToast}>{toast}</Toast>}

      <div className="min-w-0">
        <div className="card flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-2 text-content-secondary">
            <Info size={18} className="shrink-0 text-primary" aria-hidden />
            Créez les niveaux ici, puis ouvrez-les pour chaque langue depuis l&apos;onglet Langues.
          </p>
          <button type="button" onClick={() => ouvrir({ type: "ajouter" })} className="btn-primary whitespace-nowrap">
            <Plus size={18} aria-hidden />
            Ajouter un niveau
          </button>
        </div>

        <section aria-label="Liste des niveaux" aria-busy={liste.isFetching} className="card mt-6 p-0">
          {liste.isError ? (
            <div className="p-6">
              <Alert>{getErrorMessage(liste.error)}</Alert>
            </div>
          ) : !liste.data ? (
            <div className="flex justify-center py-20 text-content-secondary">
              <Loader2 className="animate-spin" aria-label="Chargement des niveaux" />
            </div>
          ) : liste.data.length === 0 ? (
            <p className="px-6 py-16 text-center text-content-secondary">Aucun niveau pour le moment.</p>
          ) : (
            <NiveauxTable niveaux={liste.data} onAction={(type, niveau) => ouvrir({ type, niveau })} />
          )}
        </section>
      </div>

      {(action?.type === "ajouter" || action?.type === "modifier") && (
        <NiveauPanel
          // key : le formulaire repart des données du niveau choisi
          key={action.type === "modifier" ? action.niveau.idNiveau : "nouveau"}
          niveau={action.type === "modifier" ? action.niveau : null}
          onClose={fermer}
          onSaved={(n) => confirmer(action.type === "ajouter" ? `Le niveau « ${n.code} » a été ajouté.` : `Le niveau « ${n.code} » a été mis à jour.`)}
        />
      )}

      {action?.type === "supprimer" && (
        <ConfirmDialog
          title="Supprimer le niveau ?"
          description={`« ${action.niveau.code} – ${action.niveau.libelle} » sera définitivement supprimé et retiré des langues où il est ouvert. Cette action est irréversible.`}
          confirmLabel="Supprimer"
          onConfirm={() =>
            supprimer.mutate(action.niveau.idNiveau, {
              onSuccess: () => confirmer(`Le niveau « ${action.niveau.code} » a été supprimé.`),
            })
          }
          onClose={fermer}
          pending={supprimer.isPending}
          error={supprimer.isError ? getErrorMessage(supprimer.error, ERREURS_SUPPRESSION) : null}
        />
      )}
    </div>
  );
}
