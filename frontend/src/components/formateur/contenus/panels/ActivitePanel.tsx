"use client";
import { PenLine } from "lucide-react";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { COMPETENCES, LIBELLES_COMPETENCE, LIBELLES_TYPE_ACTIVITE, TYPES_ACTIVITE } from "@/lib/contenus/libelles";
import type { Activite, ActiviteSaisie, Competence, TypeActivite } from "@/lib/contenus/types";
import { DIFFICULTE_MAX, DIFFICULTE_MIN, validerActivite } from "@/lib/contenus/validation";
import { ChampStatut, ZoneTexte } from "../communs";
import PanneauFormulaire, { useFormulaireContenu, type PanneauProps } from "./PanneauFormulaire";

/** Langue dont les activités ont des champs propres (caractères, pinyin, tons). */
export const CODE_MANDARIN = "zh";

const versSaisie = (a: Activite | null, idLecon: string): ActiviteSaisie =>
  a
    ? {
        idLecon: a.idLecon,
        type: a.type,
        competence: a.competence,
        difficulte: String(a.difficulte),
        consigne: a.consigne,
        contenu: a.contenu,
        critereCorrection: a.critereCorrection,
        emplacementMedia: a.emplacementMedia,
        caracteres: a.caracteres,
        pinyin: a.pinyin,
        tonsAttendus: a.tonsAttendus,
        statut: a.statut,
      }
    : {
        idLecon,
        type: "",
        competence: "",
        difficulte: "1",
        consigne: "",
        contenu: "",
        critereCorrection: "",
        emplacementMedia: "",
        caracteres: "",
        pinyin: "",
        tonsAttendus: "",
        statut: "BROUILLON",
      };

interface ActivitePanelProps extends PanneauProps<Activite> {
  /** Ajout depuis le détail d'une leçon : la leçon est fixée. */
  idLeconImposee?: string;
}

/** Ajout ou modification d'une activité (exercice) ; champs mandarin pour la langue ZH uniquement. */
export default function ActivitePanel({ idLeconImposee, ...props }: ActivitePanelProps) {
  const { ctx, existant, onClose } = props;
  const { values, errors, setField, handleSubmit, pending, erreur } = useFormulaireContenu("activite", props, versSaisie(existant, idLeconImposee ?? ""), (v) =>
    validerActivite(v, ctx, existant),
  );

  const lecons = ctx.lecons
    .filter((l) => l.statut !== "ARCHIVE" || l.id === existant?.idLecon || l.id === idLeconImposee)
    .sort((a, b) => a.ordre - b.ordre)
    .map((l) => ({ value: l.id, label: `${l.ordre}. ${l.titre}` }));
  const types = TYPES_ACTIVITE.map((t) => ({ value: t, label: LIBELLES_TYPE_ACTIVITE[t] }));
  const competences = COMPETENCES.map((c) => ({ value: c, label: LIBELLES_COMPETENCE[c] }));
  const productionLibre = values.type === "PRODUCTION_LIBRE";
  const mandarin = ctx.langue.code === CODE_MANDARIN;

  return (
    <PanneauFormulaire
      titre={existant ? "Modifier l'activité" : "Ajouter une activité"}
      icon={PenLine}
      label="Formulaire de l'activité"
      onClose={onClose}
      onSubmit={handleSubmit}
      pending={pending}
      erreur={erreur}
    >
      {idLeconImposee ? (
        // Leçon fixée : affichée en texte (un champ désactivé ne recevrait pas le focus d'ouverture du panneau)
        <div className="mt-4">
          <p className="font-medium text-content">Leçon</p>
          <p className="mt-1 text-content-secondary">{lecons.find((l) => l.value === idLeconImposee)?.label ?? "—"}</p>
          {errors.idLecon && <p className="msg-error mt-1.5">{errors.idLecon}</p>}
        </div>
      ) : (
        <FormField id="activite-lecon" label="Leçon *" error={errors.idLecon}>
          {(field) => <Select {...field} placeholder="Choisir une leçon" options={lecons} value={values.idLecon} onChange={(e) => setField("idLecon", e.target.value)} />}
        </FormField>
      )}

      <div className="grid gap-x-3 sm:grid-cols-2">
        <FormField id="activite-type" label="Type *" error={errors.type}>
          {(field) => (
            <Select {...field} placeholder="Choisir un type" options={types} value={values.type} onChange={(e) => setField("type", e.target.value as TypeActivite)} />
          )}
        </FormField>
        <FormField id="activite-competence" label="Compétence *" error={errors.competence}>
          {(field) => (
            <Select
              {...field}
              placeholder="Choisir une compétence"
              options={competences}
              value={values.competence}
              onChange={(e) => setField("competence", e.target.value as Competence)}
            />
          )}
        </FormField>
      </div>

      <FormField id="activite-difficulte" label="Difficulté *" error={errors.difficulte} hint={`Entier de ${DIFFICULTE_MIN} (facile) à ${DIFFICULTE_MAX} (difficile).`}>
        {(field) => (
          <Input
            {...field}
            type="number"
            min={DIFFICULTE_MIN}
            max={DIFFICULTE_MAX}
            step={1}
            inputMode="numeric"
            value={values.difficulte}
            onChange={(e) => setField("difficulte", e.target.value)}
          />
        )}
      </FormField>

      <FormField id="activite-consigne" label="Consigne *" error={errors.consigne}>
        {(field) => <ZoneTexte {...field} value={values.consigne} onChange={(e) => setField("consigne", e.target.value)} />}
      </FormField>

      <FormField id="activite-contenu" label="Contenu" error={errors.contenu} hint="Texte support de l'activité (questions, propositions, texte à lire…).">
        {(field) => <ZoneTexte {...field} rows={4} value={values.contenu} onChange={(e) => setField("contenu", e.target.value)} />}
      </FormField>

      <FormField
        id="activite-critere"
        label={productionLibre ? "Réponse de référence ou critère de correction *" : "Réponse de référence ou critère de correction"}
        error={errors.critereCorrection}
        hint={productionLibre ? "Obligatoire pour une production libre (corrigée par le formateur)." : "Facultatif pour ce type d'activité."}
      >
        {(field) => <ZoneTexte {...field} value={values.critereCorrection} onChange={(e) => setField("critereCorrection", e.target.value)} />}
      </FormField>

      <FormField
        id="activite-media"
        label="Emplacement du fichier audio ou image"
        error={errors.emplacementMedia}
        hint="Pas de téléversement : décrivez l'emplacement attendu du fichier."
      >
        {(field) => <Input {...field} value={values.emplacementMedia} onChange={(e) => setField("emplacementMedia", e.target.value)} />}
      </FormField>

      {mandarin && (
        <fieldset className="mt-6 rounded-btn border border-border px-4 pb-4">
          <legend className="px-1 font-semibold text-primary">Champs du mandarin</legend>
          <FormField id="activite-caracteres" label="Caractères" error={errors.caracteres}>
            {(field) => <Input {...field} lang="zh" value={values.caracteres} onChange={(e) => setField("caracteres", e.target.value)} />}
          </FormField>
          <FormField id="activite-pinyin" label="Pinyin" error={errors.pinyin}>
            {(field) => <Input {...field} lang="zh-Latn" spellCheck={false} value={values.pinyin} onChange={(e) => setField("pinyin", e.target.value)} />}
          </FormField>
          {values.competence === "ORAL" && (
            <FormField id="activite-tons" label="Tons attendus" error={errors.tonsAttendus} hint="Pour une activité de compétence orale.">
              {(field) => <Input {...field} spellCheck={false} value={values.tonsAttendus} onChange={(e) => setField("tonsAttendus", e.target.value)} />}
            </FormField>
          )}
        </fieldset>
      )}

      <ChampStatut id="activite-statut" value={values.statut} actuel={existant?.statut ?? null} error={errors.statut} onChange={(s) => setField("statut", s)} />
    </PanneauFormulaire>
  );
}
