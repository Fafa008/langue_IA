"use client";
import { ArrowDown, ArrowUp, Plus, Route, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { libelleEntite } from "@/lib/contenus/libelles";
import type { ContenusLangue, Parcours, ParcoursElement, ParcoursSaisie } from "@/lib/contenus/types";
import { peutEtreAjouteAuParcours, trouverElement, validerParcours } from "@/lib/contenus/validation";
import { ChampStatut, StatutContenuBadge } from "../communs";
import PanneauFormulaire, { useFormulaireContenu, type PanneauProps } from "./PanneauFormulaire";

const versSaisie = (p: Parcours | null): ParcoursSaisie =>
  p ? { titre: p.titre, idNiveauCible: p.idNiveauCible, elements: p.elements, statut: p.statut } : { titre: "", idNiveauCible: "", elements: [], statut: "BROUILLON" };

const cle = (e: ParcoursElement) => `${e.type}:${e.id}`;

/** « Leçon 3 – Leçon 3 », « Activité (leçon 3) – QCM : … ». */
function libelleElement(e: ParcoursElement, ctx: ContenusLangue): string {
  const entite = trouverElement(e, ctx);
  if (!entite) return "Élément introuvable";
  if (e.type === "lecon") return `Leçon ${"ordre" in entite ? entite.ordre : ""} – ${libelleEntite("lecon", entite)}`;
  const lecon = ctx.lecons.find((l) => "idLecon" in entite && l.id === entite.idLecon);
  return `Activité (leçon ${lecon?.ordre ?? "?"}) – ${libelleEntite("activite", entite)}`;
}

/** Ajout ou modification d'un parcours : titre, niveau cible, statut et liste ordonnée de leçons ou d'activités. */
export default function ParcoursPanel(props: PanneauProps<Parcours>) {
  const { ctx, existant, onClose } = props;
  const { values, errors, setField, handleSubmit, pending, erreur } = useFormulaireContenu("parcours", props, versSaisie(existant), (v) =>
    validerParcours(v, ctx, existant),
  );
  const [choix, setChoix] = useState("");

  const presents = new Set(values.elements.map(cle));
  const niveaux = ctx.langue.niveaux.map((n) => ({ value: n.id, label: n.code }));
  const leconsTriees = [...ctx.lecons].sort((a, b) => a.ordre - b.ordre);
  // RG-GP-06 : les éléments archivés ne sont pas proposés
  const ajoutables: { value: string; label: string; groupe: string }[] = [
    ...leconsTriees.filter(peutEtreAjouteAuParcours).map((l) => ({ value: cle({ type: "lecon", id: l.id }), label: `Leçon ${l.ordre} – ${l.titre}`, groupe: "Leçons" })),
    ...leconsTriees.flatMap((l) =>
      ctx.activites
        .filter((a) => a.idLecon === l.id && peutEtreAjouteAuParcours(a))
        .map((a) => ({ value: cle({ type: "activite", id: a.id }), label: `Leçon ${l.ordre} – ${libelleEntite("activite", a)}`, groupe: "Activités" })),
    ),
  ].filter((o) => !presents.has(o.value));

  function changerElements(elements: ParcoursElement[]) {
    setField("elements", elements);
  }

  function ajouter() {
    if (!choix) return;
    const [type, id] = choix.split(":") as [ParcoursElement["type"], string];
    changerElements([...values.elements, { type, id }]);
    setChoix("");
  }

  function deplacer(index: number, sens: -1 | 1) {
    const elements = [...values.elements];
    const [element] = elements.splice(index, 1);
    const cible = index + sens;
    elements.splice(cible, 0, element);
    changerElements(elements);
    // Le focus suit l'élément déplacé ; au bord de la liste, il passe sur l'autre flèche
    const auBord = (sens === -1 && cible === 0) || (sens === 1 && cible === elements.length - 1);
    const fleche = (auBord ? -sens : sens) === -1 ? "monter" : "descendre";
    requestAnimationFrame(() => document.getElementById(`parcours-element-${cle(element)}-${fleche}`)?.focus());
  }

  function retirer(index: number) {
    changerElements(values.elements.filter((_, i) => i !== index));
    requestAnimationFrame(() => document.getElementById("parcours-ajout")?.focus());
  }

  const messageElements = errors.elements ? "parcours-elements-message" : "parcours-elements-aide";

  return (
    <PanneauFormulaire
      titre={existant ? "Modifier le parcours" : "Ajouter un parcours"}
      icon={Route}
      label="Formulaire du parcours"
      onClose={onClose}
      onSubmit={handleSubmit}
      pending={pending}
      erreur={erreur}
    >
      <FormField id="parcours-titre" label="Titre *" error={errors.titre}>
        {(field) => <Input {...field} value={values.titre} onChange={(e) => setField("titre", e.target.value)} />}
      </FormField>

      <FormField id="parcours-niveau" label="Niveau cible *" error={errors.idNiveauCible} hint={`Niveaux ouverts pour la langue ${ctx.langue.libelle}.`}>
        {(field) => (
          <Select {...field} placeholder="Choisir un niveau" options={niveaux} value={values.idNiveauCible} onChange={(e) => setField("idNiveauCible", e.target.value)} />
        )}
      </FormField>

      <fieldset className="mt-4" aria-describedby={messageElements}>
        <legend className="mb-1.5 font-medium text-content">Éléments du parcours *</legend>

        {values.elements.length === 0 ? (
          <p className="rounded-btn border border-dashed border-border px-4 py-3 text-content-secondary">Aucun élément pour l&apos;instant.</p>
        ) : (
          <ol aria-label="Éléments du parcours, dans l'ordre" className="divide-y divide-border rounded-btn border border-border">
            {values.elements.map((e, i) => {
              const nom = libelleElement(e, ctx);
              const entite = trouverElement(e, ctx);
              return (
                <li key={cle(e)} className="flex items-start gap-2 px-3 py-2.5">
                  <span className="mt-0.5 w-6 shrink-0 text-right font-semibold text-primary">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-content">{nom}</span>
                    {entite && entite.statut !== "PUBLIE" && (
                      <span className="mt-1 inline-block">
                        <StatutContenuBadge statut={entite.statut} />
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <BoutonIcone id={`parcours-element-${cle(e)}-monter`} label={`Monter « ${nom} »`} disabled={i === 0} onClick={() => deplacer(i, -1)}>
                      <ArrowUp size={16} aria-hidden />
                    </BoutonIcone>
                    <BoutonIcone
                      id={`parcours-element-${cle(e)}-descendre`}
                      label={`Descendre « ${nom} »`}
                      disabled={i === values.elements.length - 1}
                      onClick={() => deplacer(i, 1)}
                    >
                      <ArrowDown size={16} aria-hidden />
                    </BoutonIcone>
                    <BoutonIcone label={`Retirer « ${nom} » du parcours`} onClick={() => retirer(i)} danger>
                      <X size={16} aria-hidden />
                    </BoutonIcone>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Champ et bouton l'un sous l'autre : la largeur du panneau ne suffit pas pour les libellés d'activité */}
        <div className="mt-3 flex flex-col gap-2">
          <div className="min-w-0">
            <label htmlFor="parcours-ajout" className="mb-1.5 block text-small font-medium text-content">
              Élément à ajouter
            </label>
            <div className="relative">
              <select
                id="parcours-ajout"
                value={choix}
                onChange={(e) => setChoix(e.target.value)}
                // Le message d'erreur du groupe est relié à ce champ, qui reçoit le focus en cas d'erreur
                aria-invalid={Boolean(errors.elements)}
                aria-describedby={messageElements}
                className={`input pr-10 ${errors.elements ? "input-error" : ""}`}
              >
                <option value="">{ajoutables.length === 0 ? "Aucun élément disponible" : "Choisir une leçon ou une activité"}</option>
                {["Leçons", "Activités"].map((groupe) => {
                  const options = ajoutables.filter((o) => o.groupe === groupe);
                  return options.length === 0 ? null : (
                    <optgroup key={groupe} label={groupe}>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          </div>
          <button type="button" onClick={ajouter} disabled={!choix} className="btn-secondary self-start whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={18} aria-hidden />
            Ajouter au parcours
          </button>
        </div>

        {errors.elements ? (
          <p id="parcours-elements-message" className="msg-error mt-1.5">
            {errors.elements}
          </p>
        ) : (
          <p id="parcours-elements-aide" className="mt-1.5 text-small text-content-secondary">
            Au moins un élément. Les éléments archivés ne sont pas proposés ; un parcours publié ne contient que des éléments publiés.
          </p>
        )}
      </fieldset>

      <ChampStatut id="parcours-statut" value={values.statut} actuel={existant?.statut ?? null} error={errors.statut} onChange={(s) => setField("statut", s)} />
    </PanneauFormulaire>
  );
}

function BoutonIcone({
  id,
  label,
  disabled,
  danger = false,
  onClick,
  children,
}: {
  id?: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border border-border p-1.5 text-content-secondary hover:bg-background disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "hover:border-error/40 hover:text-error" : "hover:border-primary/40 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
