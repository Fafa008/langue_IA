"use client";
import { Loader2, SearchX, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import PaginationFooter from "@/components/ui/PaginationFooter";
import Toast from "@/components/ui/Toast";
import { useSession } from "@/hooks/useSession";
import { useUtilisateurs, useUtilisateursFiltres } from "@/hooks/useUtilisateurs";
import { getErrorMessage } from "@/lib/api-client";
import { nombreDePages } from "@/lib/pagination";
import type { Utilisateur } from "@/types/utilisateur";
import ChangerStatutDialog from "./ChangerStatutDialog";
import ModifierUtilisateurDialog from "./ModifierUtilisateurDialog";
import UtilisateursFilters from "./UtilisateursFilters";
import UtilisateursTable from "./UtilisateursTable";

type ActionEnCours = { type: "modifier" | "statut"; utilisateur: Utilisateur } | null;

const nomComplet = (u: Utilisateur) => `${u.prenom} ${u.nom}`;

/** Page « Gestion des utilisateurs » : recherche, filtre par rôle, tableau paginé, modification et (dés)activation. */
export default function UtilisateursView() {
  const { utilisateur: courant } = useSession();
  const [action, setAction] = useState<ActionEnCours>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fermerToast = useCallback(() => setToast(null), []);
  const fermerAction = () => setAction(null);

  function confirmer(message: string) {
    setAction(null);
    setToast(message);
  }

  const { filtres, setFiltres } = useUtilisateursFiltres();
  const liste = useUtilisateurs(filtres);
  const data = liste.data;
  const totalPages = data ? nombreDePages(data.total, data.taille) : 1;

  // Page demandée au-delà de la dernière (lien ancien, suppression…) : retour à la dernière page
  useEffect(() => {
    if (data && !liste.isPlaceholderData && filtres.page > totalPages) setFiltres({ page: totalPages });
  }, [data, liste.isPlaceholderData, filtres.page, totalPages, setFiltres]);

  return (
    <div className="mx-auto max-w-7xl">
      {toast && <Toast onClose={fermerToast}>{toast}</Toast>}

      {action?.type === "modifier" && (
        <ModifierUtilisateurDialog
          utilisateur={action.utilisateur}
          estSoiMeme={action.utilisateur.idUser === courant?.idUser}
          onClose={fermerAction}
          onSaved={(u) => confirmer(`Les informations de ${nomComplet(u)} ont été mises à jour.`)}
        />
      )}
      {action?.type === "statut" && (
        <ChangerStatutDialog
          utilisateur={action.utilisateur}
          onClose={fermerAction}
          onSaved={(u) => confirmer(`Le compte de ${nomComplet(u)} a été ${u.statut === "ACTIF" ? "réactivé" : "désactivé"}.`)}
        />
      )}

      <div className="mb-8 flex items-start gap-4">
        <UsersRound size={36} className="mt-1 shrink-0 text-primary" aria-hidden />
        <div>
          <h1>Gestion des utilisateurs</h1>
          <p className="mt-1 text-base text-content-secondary">Consultez et gérez les utilisateurs de la plateforme.</p>
        </div>
      </div>

      <UtilisateursFilters filtres={filtres} onChange={setFiltres} />

      <section aria-label="Liste des utilisateurs" aria-busy={liste.isFetching} className="card mt-6 p-0">
        {liste.isError ? (
          <div className="p-6">
            <Alert>{getErrorMessage(liste.error)}</Alert>
          </div>
        ) : !data ? (
          <div className="flex justify-center py-20 text-content-secondary">
            <Loader2 className="animate-spin" aria-label="Chargement des utilisateurs" />
          </div>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center text-content-secondary">
            <SearchX size={36} className="text-primary" aria-hidden />
            <p className="mt-3 font-medium text-content">Aucun utilisateur ne correspond à votre recherche.</p>
            <p className="mt-1">Modifiez le texte recherché ou le filtre de rôle.</p>
          </div>
        ) : (
          // Atténué pendant le chargement de la page suivante
          <div className={`transition-opacity ${liste.isPlaceholderData ? "opacity-60" : ""}`}>
            <UtilisateursTable
              utilisateurs={data.items}
              idCourant={courant?.idUser}
              onModifier={(utilisateur) => setAction({ type: "modifier", utilisateur })}
              onChangerStatut={(utilisateur) => setAction({ type: "statut", utilisateur })}
            />
          </div>
        )}

        {data && data.total > 0 && (
          <PaginationFooter
            data={data}
            element="utilisateur"
            onPage={(page) => setFiltres({ page })}
            onTaille={(taille) => setFiltres({ taille })}
          />
        )}
      </section>
    </div>
  );
}
