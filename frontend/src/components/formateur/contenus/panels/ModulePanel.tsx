"use client";
import { FolderOpen } from "lucide-react";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import type { Module, ModuleSaisie } from "@/lib/contenus/types";
import { prochainOrdre, validerModule } from "@/lib/contenus/validation";
import { ChampStatut } from "../communs";
import PanneauFormulaire, { useFormulaireContenu, type PanneauProps } from "./PanneauFormulaire";

const versSaisie = (m: Module | null, ordreParDefaut: number): ModuleSaisie =>
  m ? { titre: m.titre, ordre: String(m.ordre), statut: m.statut } : { titre: "", ordre: String(ordreParDefaut), statut: "BROUILLON" };

/** Ajout ou modification d'un module : titre, numéro d'ordre (unique dans la langue), statut. */
export default function ModulePanel(props: PanneauProps<Module>) {
  const { ctx, existant, onClose } = props;
  const { values, errors, setField, handleSubmit, pending, erreur } = useFormulaireContenu("module", props, versSaisie(existant, prochainOrdre(ctx.modules)), (v) =>
    validerModule(v, ctx, existant),
  );

  return (
    <PanneauFormulaire
      titre={existant ? "Modifier le module" : "Ajouter un module"}
      icon={FolderOpen}
      label="Formulaire du module"
      onClose={onClose}
      onSubmit={handleSubmit}
      pending={pending}
      erreur={erreur}
    >
      <FormField id="module-titre" label="Titre *" error={errors.titre}>
        {(field) => <Input {...field} value={values.titre} onChange={(e) => setField("titre", e.target.value)} />}
      </FormField>

      <FormField id="module-ordre" label="Numéro d'ordre *" error={errors.ordre} hint={`Entier positif, unique pour la langue ${ctx.langue.libelle}.`}>
        {(field) => <Input {...field} type="number" min={1} step={1} inputMode="numeric" value={values.ordre} onChange={(e) => setField("ordre", e.target.value)} />}
      </FormField>

      <ChampStatut id="module-statut" value={values.statut} actuel={existant?.statut ?? null} error={errors.statut} onChange={(s) => setField("statut", s)} />
    </PanneauFormulaire>
  );
}
