"use client";
import { Loader2, SearchX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PaginationFooter from "@/components/ui/PaginationFooter";
import Toast from "@/components/ui/Toast";
import { useLangues, useLanguesFiltres, useSupprimerLangue } from "@/hooks/useLangues";
import { HTTP_STATUS, getErrorMessage } from "@/lib/api-client";
import { nombreDePages } from "@/lib/pagination";
import type { LangueAvecNiveaux } from "@/types/langue";
import LanguePanel from "./LanguePanel";
import LanguesFilters from "./LanguesFilters";
import LanguesTable, { type ActionLangue } from "./LanguesTable";

type ActionEnCours = { type: "ajouter" } | { type: ActionLangue; langue: LangueAvecNiveaux } | null;

const ERREURS_SUPPRESSION = {
  [HTTP_STATUS.CONFLICT]: "Cette langue est utilisée par des formules ou des parcours : elle ne peut pas être supprimée.",
};

/** Onglet « Langues » : liste filtrée et paginée, ajout, modification, suppression (titre et onglets : layout du dossier). */
export default function LanguesView() {
  const { filtres, setFiltres } = useLanguesFiltres();
  const liste = useLangues(filtres);
  const data = liste.data;
  const totalPages = data ? nombreDePages(data.total, data.taille) : 1;

  const [action, setAction] = useState<ActionEnCours>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fermerToast = useCallback(() => setToast(null), []);
  const fermer = useCallback(() => setAction(null), []);
  const supprimer = useSupprimerLangue();

  // Page demandée au-delà de la dernière (après une suppression, lien ancien…) : retour à la dernière page
  useEffect(() => {
    if (data && !liste.isPlaceholderData && filtres.page > totalPages) setFiltres({ page: totalPages });
  }, [data, liste.isPlaceholderData, filtres.page, totalPages, setFiltres]);

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
        <LanguesFilters filtres={filtres} onChange={setFiltres} onAjouter={() => ouvrir({ type: "ajouter" })} />

        <section aria-label="Liste des langues" aria-busy={liste.isFetching} className="card mt-6 p-0">
          {liste.isError ? (
            <div className="p-6">
              <Alert>{getErrorMessage(liste.error)}</Alert>
            </div>
          ) : !data ? (
            <div className="flex justify-center py-20 text-content-secondary">
              <Loader2 className="animate-spin" aria-label="Chargement des langues" />
            </div>
          ) : data.items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center text-content-secondary">
              <SearchX size={36} className="text-primary" aria-hidden />
              <p className="mt-3 font-medium text-content">Aucune langue ne correspond à votre recherche.</p>
              <p className="mt-1">Modifiez le texte recherché.</p>
            </div>
          ) : (
            <div className={`transition-opacity ${liste.isPlaceholderData ? "opacity-60" : ""}`}>
              <LanguesTable langues={data.items} onAction={(type, langue) => ouvrir({ type, langue })} />
            </div>
          )}

          {data && data.total > 0 && (
            <PaginationFooter
              data={data}
              element="langue"
              onPage={(page) => setFiltres({ page })}
              onTaille={(taille) => setFiltres({ taille })}
            />
          )}
        </section>
      </div>

      {(action?.type === "ajouter" || action?.type === "modifier") && (
        <LanguePanel
          // key : le formulaire repart des données de la langue choisie
          key={action.type === "modifier" ? action.langue.idLangue : "nouvelle"}
          langue={action.type === "modifier" ? action.langue : null}
          onClose={fermer}
          onSaved={(l) => confirmer(action.type === "ajouter" ? `La langue « ${l.libelle} » a été ajoutée.` : `La langue « ${l.libelle} » a été mise à jour.`)}
        />
      )}

      {action?.type === "supprimer" && (
        <ConfirmDialog
          title="Supprimer la langue ?"
          description={`« ${action.langue.libelle} » sera définitivement supprimée. Cette action est irréversible.`}
          confirmLabel="Supprimer"
          onConfirm={() =>
            supprimer.mutate(action.langue.idLangue, {
              onSuccess: () => confirmer(`La langue « ${action.langue.libelle} » a été supprimée.`),
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
