"use client";
import { Globe, Loader2, Save } from "lucide-react";
import Link from "next/link";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import SidePanel from "@/components/ui/SidePanel";
import { useForm } from "@/hooks/useForm";
import { useCreerLangue, useModifierLangue } from "@/hooks/useLangues";
import { useNiveaux } from "@/hooks/useNiveaux";
import { ApiError, HTTP_STATUS, getErrorMessage } from "@/lib/api-client";
import { ROUTES } from "@/lib/routes";
import { formatCodeLangue, normaliserEspaces } from "@/lib/saisie";
import { validateLangue } from "@/lib/validation/langue";
import type { LangueAvecNiveaux, LangueFormValues, Niveau } from "@/types/langue";
import LangueFlag from "./LangueFlag";

const ERREURS = {
  [HTTP_STATUS.CONFLICT]: "Ce code est déjà utilisé par une autre langue.",
};

const toFormValues = (langue: LangueAvecNiveaux | null): LangueFormValues =>
  langue
    ? { libelle: langue.libelle, code: langue.code.toUpperCase(), idNiveaux: langue.niveaux.map((n) => n.idNiveau) }
    : { libelle: "", code: "", idNiveaux: [] };

interface LanguePanelProps {
  /** null : création d'une nouvelle langue. */
  langue: LangueAvecNiveaux | null;
  onClose: () => void;
  onSaved: (langue: LangueAvecNiveaux) => void;
}

/** Ajout ou modification d'une langue : désignation, code et niveaux ouverts (association LangueNiveau). */
export default function LanguePanel({ langue, onClose, onSaved }: LanguePanelProps) {
  const creer = useCreerLangue();
  const modifier = useModifierLangue();
  const mutation = langue ? modifier : creer;

  const form = useForm({
    initialValues: toFormValues(langue),
    validate: validateLangue,
    onSubmit: (v) => {
      const payload = {
        libelle: normaliserEspaces(v.libelle),
        // Le code est affiché en majuscules mais enregistré en minuscules (ISO 639)
        code: v.code.trim().toLowerCase(),
        idNiveaux: v.idNiveaux,
      };
      if (langue) modifier.mutate({ idLangue: langue.idLangue, payload }, { onSuccess: onSaved });
      else creer.mutate(payload, { onSuccess: onSaved });
    },
  });
  const { values, errors, handleSubmit } = form;

  /** Toute modification efface l'erreur renvoyée par le serveur. */
  const setField: typeof form.setField = (name, value) => {
    if (mutation.isError) mutation.reset();
    form.setField(name, value);
  };

  const codePris = mutation.error instanceof ApiError && mutation.error.status === HTTP_STATUS.CONFLICT;

  return (
    <SidePanel title={langue ? "Modifier la langue" : "Ajouter une langue"} icon={Globe} onClose={onClose} locked={mutation.isPending}>
      {langue && (
        <div className="mb-2 flex items-center gap-3">
          <LangueFlag code={langue.code} size={32} />
          <span className="text-h4 font-semibold text-content">{langue.libelle}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {mutation.isError && <Alert className="mt-4">{getErrorMessage(mutation.error, ERREURS)}</Alert>}

        <FormField id="langue-libelle" label="Désignation *" error={errors.libelle}>
          {(field) => (
            <Input {...field} placeholder="Ex. : Espagnol" value={values.libelle} onChange={(e) => setField("libelle", e.target.value)} />
          )}
        </FormField>

        <FormField id="langue-code" label="Code *" error={errors.code} hint="Code ISO de 2 ou 3 lettres (FR, EN, ZH…)">
          {({ invalid, ...field }) => (
            <Input
              {...field}
              invalid={invalid || codePris}
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Ex. : ES"
              format={formatCodeLangue}
              value={values.code}
              onChange={(e) => setField("code", e.target.value)}
            />
          )}
        </FormField>

        <ChoixNiveaux choisis={values.idNiveaux} error={errors.idNiveaux} onChange={(ids) => setField("idNiveaux", ids)} />

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {!mutation.isPending && <Save size={18} aria-hidden />}
            Enregistrer
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}

interface ChoixNiveauxProps {
  choisis: number[];
  error?: string;
  onChange: (idNiveaux: number[]) => void;
}

/** Cases à cocher des niveaux ouverts pour la langue, triés par code, avec « Tout cocher ». */
function ChoixNiveaux({ choisis, error, onChange }: ChoixNiveauxProps) {
  const niveaux = useNiveaux();
  const tous = niveaux.data ?? [];
  const toutCoche = tous.length > 0 && tous.every((n) => choisis.includes(n.idNiveau));

  function basculer(niveau: Niveau, coche: boolean) {
    onChange(coche ? [...choisis, niveau.idNiveau] : choisis.filter((id) => id !== niveau.idNiveau));
  }

  return (
    <fieldset className="mt-4" aria-describedby={error ? "langue-niveaux-message" : "langue-niveaux-aide"}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <legend className="font-medium text-content">Niveaux associés *</legend>
        {tous.length > 1 && (
          <button
            type="button"
            onClick={() => onChange(toutCoche ? [] : tous.map((n) => n.idNiveau))}
            className="text-small font-semibold text-primary hover:underline"
          >
            {toutCoche ? "Tout décocher" : "Tout cocher"}
          </button>
        )}
      </div>

      <div className={`rounded-btn border bg-surface ${error ? "border-error" : "border-border"}`}>
        {niveaux.isError ? (
          <Alert className="m-3">{getErrorMessage(niveaux.error)}</Alert>
        ) : !niveaux.data ? (
          <div className="flex justify-center py-6 text-content-secondary">
            <Loader2 className="animate-spin" aria-label="Chargement des niveaux" />
          </div>
        ) : tous.length === 0 ? (
          <p className="p-4 text-content-secondary">
            Aucun niveau n&apos;existe encore.{" "}
            <Link href={ROUTES.admin.niveaux} className="font-semibold text-primary hover:underline">
              Créez-les dans l&apos;onglet Niveaux
            </Link>
            .
          </p>
        ) : (
          <ul className="max-h-64 divide-y divide-border overflow-y-auto">
            {tous.map((n) => (
              <li key={n.idNiveau}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-background/60">
                  <input
                    type="checkbox"
                    checked={choisis.includes(n.idNiveau)}
                    onChange={(e) => basculer(n, e.target.checked)}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded accent-primary"
                  />
                  <span className="w-14 shrink-0 font-semibold text-content">{n.code}</span>
                  <span className="sr-only"> – </span>
                  <span className="truncate text-content-secondary">{n.libelle}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p id="langue-niveaux-message" className="msg-error mt-1.5">
          {error}
        </p>
      ) : (
        <p id="langue-niveaux-aide" className="mt-1.5 text-small text-content-secondary">
          Seuls les niveaux cochés seront proposés pour cette langue (tests, parcours, exercices).
        </p>
      )}
    </fieldset>
  );
}
