"use client";
import Alert from "@/components/ui/Alert";
import FormField from "@/components/ui/FormField";
import Select from "@/components/ui/Select";
import { useFormules } from "@/hooks/useFormules";
import { formatAriary, pluriel } from "@/lib/format";
import { libelleLangue } from "@/lib/languages";
import type { Formule } from "@/types/formule";

interface FormulePickerProps {
  value: number | null;
  onChange: (idFormule: number) => void;
  error?: string;
}

const libellesLangues = (formule: Formule) =>
  formule.langues.length === 0
    ? "toutes les langues"
    : formule.langues.map(libelleLangue).join(", ");

/** Résumé affiché sous la liste une fois la formule choisie. */
const details = (f: Formule) =>
  `${f.dureeMois} mois · ${f.quotaHeures} h de cours · ${pluriel(f.quotaAteliers, "atelier")} · ${libellesLangues(f)}`;

/** Choix de la formule d'abonnement dans une liste déroulante, chargée depuis l'API. */
export default function FormulePicker({ value, onChange, error }: FormulePickerProps) {
  const { data: formules = [], isPending, isError, refetch } = useFormules();
  const selected = formules.find((f) => f.idFormule === value);

  return (
    <>
      <FormField
        id="idFormule"
        label="Formule d'abonnement"
        error={error}
        hint={selected && details(selected)}
      >
        {(field) => (
          <Select
            {...field}
            disabled={isPending || isError}
            placeholder={isPending ? "Chargement des formules…" : "Choisir une formule"}
            options={formules.map((f) => ({
              value: String(f.idFormule),
              label: `${f.libelle} — ${formatAriary(f.prixMensuel)} / mois`,
            }))}
            value={value === null ? "" : String(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        )}
      </FormField>

      {isError && (
        <Alert className="mt-2">
          Impossible de charger les formules.{" "}
          <button type="button" onClick={() => refetch()} className="underline">
            Réessayer
          </button>
        </Alert>
      )}
    </>
  );
}
