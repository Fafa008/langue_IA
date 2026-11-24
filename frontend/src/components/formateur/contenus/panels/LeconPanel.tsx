"use client";
import { BookOpen } from "lucide-react";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import type { Lecon, LeconSaisie } from "@/lib/contenus/types";
import { DEBUT_PHASE_ACTIVE, lireEntierPositif, phaseAssimil, prochainOrdre, validerLecon } from "@/lib/contenus/validation";
import { ChampStatut, ZoneTexte } from "../communs";
import PanneauFormulaire, { useFormulaireContenu, type PanneauProps } from "./PanneauFormulaire";

const LIBELLES_PHASE = { passive: "Passive", active: "Active" };

const versSaisie = (l: Lecon | null, ordreParDefaut: number): LeconSaisie =>
  l
    ? { idModule: l.idModule, idNiveau: l.idNiveau, titre: l.titre, ordre: String(l.ordre), description: l.description, statut: l.statut }
    : { idModule: "", idNiveau: "", titre: "", ordre: String(ordreParDefaut), description: "", statut: "BROUILLON" };

/** Ajout ou modification d'une leçon ; la phase Assimil est calculée depuis le numéro d'ordre. */
export default function LeconPanel(props: PanneauProps<Lecon>) {
  const { ctx, existant, onClose } = props;
  const { values, errors, setField, handleSubmit, pending, erreur } = useFormulaireContenu("lecon", props, versSaisie(existant, prochainOrdre(ctx.lecons)), (v) =>
    validerLecon(v, ctx, existant),
  );

  // Modules archivés : non proposés, sauf celui de la leçon modifiée
  const modules = ctx.modules
    .filter((m) => m.statut !== "ARCHIVE" || m.id === existant?.idModule)
    .sort((a, b) => a.ordre - b.ordre)
    .map((m) => ({ value: m.id, label: `${m.ordre}. ${m.titre}` }));
  const niveaux = ctx.langue.niveaux.map((n) => ({ value: n.id, label: n.code }));
  const phase = phaseAssimil(lireEntierPositif(values.ordre));

  return (
    <PanneauFormulaire
      titre={existant ? "Modifier la leçon" : "Ajouter une leçon"}
      icon={BookOpen}
      label="Formulaire de la leçon"
      onClose={onClose}
      onSubmit={handleSubmit}
      pending={pending}
      erreur={erreur}
    >
      <FormField id="lecon-module" label="Module *" error={errors.idModule}>
        {(field) => <Select {...field} placeholder="Choisir un module" options={modules} value={values.idModule} onChange={(e) => setField("idModule", e.target.value)} />}
      </FormField>

      <FormField id="lecon-niveau" label="Niveau *" error={errors.idNiveau} hint={`Niveaux ouverts pour la langue ${ctx.langue.libelle}.`}>
        {(field) => <Select {...field} placeholder="Choisir un niveau" options={niveaux} value={values.idNiveau} onChange={(e) => setField("idNiveau", e.target.value)} />}
      </FormField>

      <FormField id="lecon-titre" label="Titre *" error={errors.titre}>
        {(field) => <Input {...field} value={values.titre} onChange={(e) => setField("titre", e.target.value)} />}
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="lecon-ordre" label="Numéro d'ordre *" error={errors.ordre} hint="Unique pour la langue.">
          {(field) => <Input {...field} type="number" min={1} step={1} inputMode="numeric" value={values.ordre} onChange={(e) => setField("ordre", e.target.value)} />}
        </FormField>
        <FormField id="lecon-phase" label="Phase Assimil" hint={`Passive de 1 à ${DEBUT_PHASE_ACTIVE - 1}, active à partir de ${DEBUT_PHASE_ACTIVE}.`}>
          {({ invalid: _invalid, ...field }) => <Input {...field} readOnly value={phase ? LIBELLES_PHASE[phase] : "—"} className="bg-background" />}
        </FormField>
      </div>

      <FormField id="lecon-description" label="Description" error={errors.description} hint="Facultative.">
        {(field) => <ZoneTexte {...field} value={values.description} onChange={(e) => setField("description", e.target.value)} />}
      </FormField>

      <ChampStatut id="lecon-statut" value={values.statut} actuel={existant?.statut ?? null} error={errors.statut} onChange={(s) => setField("statut", s)} />
    </PanneauFormulaire>
  );
}
