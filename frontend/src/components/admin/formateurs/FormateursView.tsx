"use client";
import { Loader2, Presentation, SearchX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PaginationFooter from "@/components/ui/PaginationFooter";
import Toast from "@/components/ui/Toast";
import { useFormateurs, useFormateursFiltres, useModifierFormateur } from "@/hooks/useFormateurs";
import { getErrorMessage } from "@/lib/api-client";
import { nombreDePages } from "@/lib/pagination";
import type { Formateur } from "@/types/formateur";
import FormateurPanel from "./FormateurPanel";
import FormateursFilters from "./FormateursFilters";
import FormateursTable, { type ActionFormateur } from "./FormateursTable";

type ActionEnCours = { type: "ajouter" } | { type: ActionFormateur; formateur: Formateur } | null;

const nomComplet = (f: Formateur) => `${f.prenom} ${f.nom}`;

/** Page « Gestion des formateurs » : liste filtrée et paginée, ajout, modification, désactivation et réactivation. */
export default function FormateursView() {
  const { filtres, setFiltres } = useFormateursFiltres();
  const liste = useFormateurs(filtres);
  const data = liste.data;
  const totalPages = data ? nombreDePages(data.total, data.taille) : 1;

  const [action, setAction] = useState<ActionEnCours>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fermerToast = useCallback(() => setToast(null), []);
  const fermer = useCallback(() => setAction(null), []);
  const changerStatut = useModifierFormateur();

  // Page demandée au-delà de la dernière (lien ancien, filtre…) : retour à la dernière page
  useEffect(() => {
    if (data && !liste.isPlaceholderData && filtres.page > totalPages) setFiltres({ page: totalPages });
  }, [data, liste.isPlaceholderData, filtres.page, totalPages, setFiltres]);

  function ouvrir(next: ActionEnCours) {
    changerStatut.reset();
    setAction(next);
  }

  function confirmer(message: string) {
    setAction(null);
    setToast(message);
  }

  const panneauOuvert = action?.type === "ajouter" || action?.type === "modifier";

  return (
    <div className="mx-auto max-w-7xl">
      {toast && <Toast onClose={fermerToast}>{toast}</Toast>}

      <div className="mb-8 flex items-start gap-4">
        <Presentation size={36} className="mt-1 shrink-0 text-primary" aria-hidden />
        <div>
          <h1>Gestion des formateurs</h1>
          <p className="mt-1 text-base text-content-secondary">
            Ajoutez les formateurs, suivez leurs langues et leur contrat, et gérez l&apos;accès à leur compte.
          </p>
        </div>
      </div>

      <div className={panneauOuvert ? "lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6" : ""}>
        <div className="min-w-0">
          <FormateursFilters filtres={filtres} onChange={setFiltres} onAjouter={() => ouvrir({ type: "ajouter" })} />

          <section aria-label="Liste des formateurs" aria-busy={liste.isFetching} className="card mt-6 p-0">
            {liste.isError ? (
              <div className="p-6">
                <Alert>{getErrorMessage(liste.error)}</Alert>
              </div>
            ) : !data ? (
              <div className="flex justify-center py-20 text-content-secondary">
                <Loader2 className="animate-spin" aria-label="Chargement des formateurs" />
              </div>
            ) : data.items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center text-content-secondary">
                <SearchX size={36} className="text-primary" aria-hidden />
                <p className="mt-3 font-medium text-content">Aucun formateur ne correspond à votre recherche.</p>
                <p className="mt-1">Modifiez le texte recherché ou le filtre de statut.</p>
              </div>
            ) : (
              <div className={`transition-opacity ${liste.isPlaceholderData ? "opacity-60" : ""}`}>
                <FormateursTable formateurs={data.items} onAction={(type, formateur) => ouvrir({ type, formateur })} />
              </div>
            )}

            {data && data.total > 0 && (
              <PaginationFooter
                data={data}
                element="formateur"
                onPage={(page) => setFiltres({ page })}
                onTaille={(taille) => setFiltres({ taille })}
              />
            )}
          </section>
        </div>

        {(action?.type === "ajouter" || action?.type === "modifier") && (
          <FormateurPanel
            // key : le formulaire repart des données du formateur choisi
            key={action.type === "modifier" ? action.formateur.idUser : "nouveau"}
            formateur={action.type === "modifier" ? action.formateur : null}
            onClose={fermer}
            onSaved={(f) =>
              confirmer(
                action.type === "ajouter"
                  ? `Le formateur ${nomComplet(f)} a été ajouté. Un e-mail lui a été envoyé pour choisir son mot de passe.`
                  : `Les informations de ${nomComplet(f)} ont été mises à jour.`,
              )
            }
          />
        )}
      </div>

      {action?.type === "statut" && (
        <StatutDialog
          formateur={action.formateur}
          pending={changerStatut.isPending}
          error={changerStatut.isError ? getErrorMessage(changerStatut.error) : null}
          onClose={fermer}
          onConfirm={(statut) =>
            changerStatut.mutate(
              { idUser: action.formateur.idUser, payload: { statut } },
              {
                onSuccess: (f) =>
                  confirmer(`Le compte de ${nomComplet(f)} a été ${f.statut === "ACTIF" ? "réactivé" : "désactivé"}.`),
              },
            )
          }
        />
      )}
    </div>
  );
}

interface StatutDialogProps {
  formateur: Formateur;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (statut: "ACTIF" | "INACTIF") => void;
}

/** Confirmation avant de désactiver un formateur actif, ou de réactiver un formateur inactif ou suspendu. */
function StatutDialog({ formateur, pending, error, onClose, onConfirm }: StatutDialogProps) {
  const desactiver = formateur.statut === "ACTIF";
  const nom = <strong className="text-content">{nomComplet(formateur)}</strong>;

  return (
    <ConfirmDialog
      title={desactiver ? "Désactiver le formateur ?" : "Réactiver le formateur ?"}
      description={
        desactiver ? (
          <>
            {nom} ne pourra plus se connecter ni être affecté à de nouveaux ateliers. Ses données et son historique sont
            conservés, et le compte pourra être réactivé à tout moment.
          </>
        ) : (
          <>{nom} pourra de nouveau se connecter et être affecté à des ateliers.</>
        )
      }
      confirmLabel={desactiver ? "Désactiver" : "Réactiver"}
      onConfirm={() => onConfirm(desactiver ? "INACTIF" : "ACTIF")}
      onClose={onClose}
      pending={pending}
      error={error}
    />
  );
}
