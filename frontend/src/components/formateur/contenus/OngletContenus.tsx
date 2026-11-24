"use client";
import { BookOpen, Filter, FolderOpen, Loader2, Plus, SearchX } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import Alert from "@/components/ui/Alert";
import FilterSelect from "@/components/ui/FilterSelect";
import SearchField from "@/components/ui/SearchField";
import Toast from "@/components/ui/Toast";
import { useListeContenus } from "@/hooks/useContenus";
import { LIBELLES_STATUT, NOMS_ENTITE, STATUTS, accorder, aucun, leNom, libelleEntite, majuscule, unOuUne } from "@/lib/contenus/libelles";
import type { Activite, ContenusLangue, Entite, FiltresContenus, Lecon, Module, Parcours, Statut, TypeEntite } from "@/lib/contenus/types";
import ConfirmerRetrait from "./ConfirmerRetrait";
import { EtatVide, useRetourFocus } from "./communs";
import ActivitePanel from "./panels/ActivitePanel";
import LeconPanel from "./panels/LeconPanel";
import ModulePanel from "./panels/ModulePanel";
import ParcoursPanel from "./panels/ParcoursPanel";
import { ActivitesTable, LeconsTable, ModulesTable, ParcoursTable, type ActionLigneContenu } from "./tables";

type ActionEnCours = { type: "ajouter" } | { type: ActionLigneContenu; entite: Entite } | null;

interface OngletContenusProps {
  type: TypeEntite;
  /** Tous les contenus de la langue (libellés, règles). */
  ctx: ContenusLangue;
  /** Détail d'une leçon : seules ses activités sont listées et ajoutées. */
  idLecon?: string;
}

/** Pourquoi l'ajout est impossible (parent manquant ou archivé), ou null. */
function prerequisManquant(type: TypeEntite, ctx: ContenusLangue, idLecon?: string): string | null {
  if (type === "lecon" && !ctx.modules.some((m) => m.statut !== "ARCHIVE")) return "Créez d'abord un module (onglet Modules).";
  if (type === "activite") {
    if (idLecon) return ctx.lecons.find((l) => l.id === idLecon)?.statut === "ARCHIVE" ? "Cette leçon est archivée : aucune activité ne peut y être ajoutée." : null;
    if (!ctx.lecons.some((l) => l.statut !== "ARCHIVE")) return "Créez d'abord une leçon (onglet Leçons).";
  }
  return null;
}

/** Un onglet d'une langue (modules, leçons, activités ou parcours) : recherche, filtre, tableau, ajout, modification, archivage. */
export default function OngletContenus({ type, ctx, idLecon }: OngletContenusProps) {
  const [filtres, setFiltres] = useState<FiltresContenus>({ recherche: "", statut: null, idLecon: idLecon ?? null });
  const liste = useListeContenus(type, ctx.langue.code, filtres);
  const items = liste.data;

  const [action, setAction] = useState<ActionEnCours>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fermerToast = useCallback(() => setToast(null), []);
  const focus = useRetourFocus();
  const boutonAjouter = useRef<HTMLButtonElement>(null);
  const zoneListe = useRef<HTMLElement>(null);
  const aideAjoutId = useId();

  const nom = NOMS_ENTITE[type];
  const prerequis = prerequisManquant(type, ctx, idLecon);
  const filtresActifs = Boolean(filtres.recherche?.trim() || filtres.statut || (!idLecon && filtres.idLecon));

  function ouvrir(next: ActionEnCours) {
    focus.memoriser();
    setAction(next);
  }

  function fermer() {
    setAction(null);
    // Bouton d'origine, sinon « Ajouter », sinon la liste
    focus.restaurer(boutonAjouter.current && !boutonAjouter.current.disabled ? boutonAjouter.current : zoneListe.current);
  }

  function terminer(entite: Entite, verbe: string) {
    fermer();
    setToast(`${majuscule(leNom(type))} « ${libelleEntite(type, entite)} » a été ${verbe}.`);
  }

  const panneau = action?.type === "ajouter" || action?.type === "modifier" ? action : null;
  const existant = action?.type === "modifier" ? action.entite : null;
  const clePanneau = existant?.id ?? "nouveau";
  const panneauProps = {
    ctx,
    onClose: fermer,
    onSaved: (e: Entite) => terminer(e, existant ? `${accorder(type, "mis")} à jour` : accorder(type, "ajouté")),
  };

  return (
    <div className={panneau ? "lg:grid lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start lg:gap-6" : ""}>
      {toast && <Toast onClose={fermerToast}>{toast}</Toast>}

      <div className="min-w-0">
        <div className="card flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:flex-wrap md:items-center">
          <div role="search" className="md:min-w-[14rem] md:flex-1">
            <SearchField
              label={type === "activite" ? "Rechercher dans les consignes" : "Rechercher par titre"}
              value={filtres.recherche ?? ""}
              onSearch={(recherche) => setFiltres((f) => ({ ...f, recherche }))}
            />
          </div>
          <FilterSelect<Statut>
            icon={Filter}
            prefix="Statut :"
            label="Filtrer par statut"
            allLabel="Tous"
            value={filtres.statut ?? null}
            options={STATUTS.map((s) => ({ value: s, label: LIBELLES_STATUT[s] }))}
            onChange={(statut) => setFiltres((f) => ({ ...f, statut }))}
          />
          {type === "activite" && !idLecon && (
            <FilterSelect<string>
              icon={BookOpen}
              prefix="Leçon :"
              label="Filtrer par leçon"
              allLabel="Toutes"
              value={filtres.idLecon ?? null}
              options={[...ctx.lecons].sort((a, b) => a.ordre - b.ordre).map((l) => ({ value: l.id, label: `${l.ordre}. ${l.titre}` }))}
              onChange={(id) => setFiltres((f) => ({ ...f, idLecon: id }))}
            />
          )}
          <button
            ref={boutonAjouter}
            type="button"
            onClick={() => ouvrir({ type: "ajouter" })}
            disabled={prerequis !== null}
            aria-describedby={prerequis ? aideAjoutId : undefined}
            className="btn-primary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} aria-hidden />
            Ajouter {unOuUne(type)}
          </button>
          {prerequis && (
            <p id={aideAjoutId} className="w-full text-small text-content-secondary">
              {prerequis}
            </p>
          )}
        </div>

        <section ref={zoneListe} tabIndex={-1} aria-label={`Liste des ${nom.pluriel}`} aria-busy={liste.isFetching} className="card mt-6 p-0 focus:outline-none">
          {liste.isError ? (
            <div className="p-6">
              <Alert>Les {nom.pluriel} n&apos;ont pas pu être chargés. Réessayez.</Alert>
            </div>
          ) : !items ? (
            <div className="flex justify-center py-20 text-content-secondary">
              <Loader2 className="animate-spin" aria-label={`Chargement des ${nom.pluriel}`} />
            </div>
          ) : items.length === 0 ? (
            filtresActifs ? (
              <EtatVide icon={SearchX} titre={`${aucun(type)} ne correspond à votre recherche.`}>
                Modifiez le texte recherché ou les filtres.
              </EtatVide>
            ) : (
              <EtatVide icon={FolderOpen} titre={`${aucun(type)} pour ${idLecon ? "cette leçon" : `la langue ${ctx.langue.libelle}`}.`}>
                {prerequis ?? `Utilisez « Ajouter ${unOuUne(type)} » pour créer ${nom.feminin ? "la première" : "le premier"}.`}
              </EtatVide>
            )
          ) : (
            <div className={`transition-opacity ${liste.isPlaceholderData ? "opacity-60" : ""}`}>
              {type === "module" && <ModulesTable items={items as Module[]} ctx={ctx} onAction={(a, e) => ouvrir({ type: a, entite: e })} />}
              {type === "lecon" && <LeconsTable items={items as Lecon[]} ctx={ctx} onAction={(a, e) => ouvrir({ type: a, entite: e })} />}
              {type === "activite" && <ActivitesTable items={items as Activite[]} ctx={ctx} avecLecon={!idLecon} onAction={(a, e) => ouvrir({ type: a, entite: e })} />}
              {type === "parcours" && <ParcoursTable items={items as Parcours[]} ctx={ctx} onAction={(a, e) => ouvrir({ type: a, entite: e })} />}
            </div>
          )}
        </section>
      </div>

      {panneau && type === "module" && <ModulePanel key={clePanneau} {...panneauProps} existant={existant as Module | null} />}
      {panneau && type === "lecon" && <LeconPanel key={clePanneau} {...panneauProps} existant={existant as Lecon | null} />}
      {panneau && type === "activite" && <ActivitePanel key={clePanneau} {...panneauProps} existant={existant as Activite | null} idLeconImposee={idLecon} />}
      {panneau && type === "parcours" && <ParcoursPanel key={clePanneau} {...panneauProps} existant={existant as Parcours | null} />}

      {(action?.type === "archiver" || action?.type === "supprimer") && (
        <ConfirmerRetrait
          action={action.type}
          type={type}
          entite={action.entite}
          ctx={ctx}
          onClose={fermer}
          onDone={() => terminer(action.entite, accorder(type, action.type === "archiver" ? "archivé" : "supprimé"))}
        />
      )}
    </div>
  );
}
