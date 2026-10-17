"use client";
import { Loader2, Mail, Phone, Presentation, Save, UserRound } from "lucide-react";
import Link from "next/link";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import IconInput from "@/components/ui/IconInput";
import Select from "@/components/ui/Select";
import SidePanel from "@/components/ui/SidePanel";
import { useCreerFormateur, useModifierFormateur } from "@/hooks/useFormateurs";
import { useForm } from "@/hooks/useForm";
import { useLanguesChoix } from "@/hooks/useLangues";
import { ApiError, HTTP_STATUS, getErrorMessage } from "@/lib/api-client";
import { TYPE_CONTRAT_LABELS, TYPES_CONTRAT } from "@/lib/formateur";
import { ROUTES } from "@/lib/routes";
import { formatEmail, formatNom, formatPrenom, formatTelephone, normaliserEmail, normaliserEspaces } from "@/lib/saisie";
import { CERTIFICATIONS_MAX, validateFormateur } from "@/lib/validation/formateur";
import type { Formateur, FormateurFormValues, FormateurPayload, TypeContrat } from "@/types/formateur";

const ERREURS = {
  [HTTP_STATUS.CONFLICT]: "Cette adresse e-mail est déjà utilisée par un autre compte.",
};

const CONTRAT_OPTIONS = TYPES_CONTRAT.map((type) => ({ value: type, label: TYPE_CONTRAT_LABELS[type] }));

const toFormValues = (f: Formateur | null): FormateurFormValues =>
  f
    ? {
        prenom: f.prenom,
        nom: f.nom,
        email: f.email,
        telephone: formatTelephone(f.telephone ?? ""),
        typeContrat: f.typeContrat ?? "",
        certifications: f.certifications ?? "",
        idLangues: f.languesEnseignees.map((l) => l.idLangue),
      }
    : { prenom: "", nom: "", email: "", telephone: "", typeContrat: "", certifications: "", idLangues: [] };

const toPayload = (v: FormateurFormValues): FormateurPayload => ({
  prenom: normaliserEspaces(v.prenom),
  nom: normaliserEspaces(v.nom),
  email: normaliserEmail(v.email),
  telephone: normaliserEspaces(v.telephone) || null,
  typeContrat: v.typeContrat as TypeContrat,
  certifications: v.certifications.trim() || null,
  idLangues: v.idLangues,
});

interface FormateurPanelProps {
  /** null : ajout d'un nouveau formateur. */
  formateur: Formateur | null;
  onClose: () => void;
  onSaved: (formateur: Formateur) => void;
}

/** Ajout ou modification d'un formateur : identité, contrat, certifications et langues enseignées. */
export default function FormateurPanel({ formateur, onClose, onSaved }: FormateurPanelProps) {
  const creer = useCreerFormateur();
  const modifier = useModifierFormateur();
  const mutation = formateur ? modifier : creer;

  const form = useForm({
    initialValues: toFormValues(formateur),
    validate: validateFormateur,
    onSubmit: (v) => {
      const payload = toPayload(v);
      if (formateur) modifier.mutate({ idUser: formateur.idUser, payload }, { onSuccess: onSaved });
      else creer.mutate(payload, { onSuccess: onSaved });
    },
  });
  const { values, errors, handleSubmit } = form;

  /** Toute modification efface l'erreur renvoyée par le serveur. */
  const setField: typeof form.setField = (name, value) => {
    if (mutation.isError) mutation.reset();
    form.setField(name, value);
  };

  const emailPris = mutation.error instanceof ApiError && mutation.error.status === HTTP_STATUS.CONFLICT;

  return (
    <SidePanel
      title={formateur ? "Modifier le formateur" : "Ajouter un formateur"}
      icon={Presentation}
      onClose={onClose}
      locked={mutation.isPending}
    >
      <form onSubmit={handleSubmit} noValidate>
        {mutation.isError && <Alert className="mt-4">{getErrorMessage(mutation.error, ERREURS)}</Alert>}

        <FormField id="formateur-prenom" label="Prénom *" error={errors.prenom}>
          {(field) => (
            <IconInput {...field} icon={UserRound} format={formatPrenom} value={values.prenom} onChange={(e) => setField("prenom", e.target.value)} />
          )}
        </FormField>
        <FormField id="formateur-nom" label="Nom *" error={errors.nom}>
          {(field) => (
            <IconInput {...field} icon={UserRound} format={formatNom} value={values.nom} onChange={(e) => setField("nom", e.target.value)} />
          )}
        </FormField>

        <FormField
          id="formateur-email"
          label="Adresse e-mail *"
          error={errors.email}
          hint={formateur ? undefined : "Le formateur y recevra un lien pour choisir son mot de passe."}
        >
          {({ invalid, ...field }) => (
            <IconInput
              {...field}
              icon={Mail}
              invalid={invalid || emailPris}
              type="text"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              format={formatEmail}
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          )}
        </FormField>

        <FormField id="formateur-telephone" label="Téléphone" error={errors.telephone}>
          {(field) => (
            <IconInput
              {...field}
              icon={Phone}
              type="tel"
              inputMode="numeric"
              placeholder="030 00 000 00"
              format={formatTelephone}
              value={values.telephone}
              onChange={(e) => setField("telephone", e.target.value)}
            />
          )}
        </FormField>

        <FormField id="formateur-contrat" label="Type de contrat *" error={errors.typeContrat}>
          {(field) => (
            <Select
              {...field}
              placeholder="Choisir un contrat"
              options={CONTRAT_OPTIONS}
              value={values.typeContrat}
              onChange={(e) => setField("typeContrat", e.target.value as TypeContrat)}
            />
          )}
        </FormField>

        <ChoixLangues choisies={values.idLangues} error={errors.idLangues} onChange={(ids) => setField("idLangues", ids)} />

        <FormField
          id="formateur-certifications"
          label="Certifications"
          error={errors.certifications}
          hint={`Diplômes, habilitations… (${CERTIFICATIONS_MAX} caractères au plus)`}
        >
          {({ invalid, ...field }) => (
            <textarea
              {...field}
              aria-invalid={invalid}
              rows={3}
              maxLength={CERTIFICATIONS_MAX}
              placeholder="Ex. : DALF C2, habilitation examinateur DELF"
              className={`input resize-y ${invalid ? "input-error" : ""}`}
              value={values.certifications}
              onChange={(e) => setField("certifications", e.target.value)}
            />
          )}
        </FormField>

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

interface ChoixLanguesProps {
  choisies: number[];
  error?: string;
  onChange: (idLangues: number[]) => void;
}

/** Cases à cocher des langues du catalogue enseignées par le formateur (table FormateurLangue). */
function ChoixLangues({ choisies, error, onChange }: ChoixLanguesProps) {
  const langues = useLanguesChoix();

  return (
    <fieldset className="mt-4" aria-invalid={Boolean(error)} aria-describedby={error ? "formateur-langues-message" : undefined}>
      <legend className="mb-1.5 font-medium text-content">Langues enseignées *</legend>

      <div className={`rounded-btn border bg-surface ${error ? "border-error" : "border-border"}`}>
        {langues.isError ? (
          <Alert className="m-3">{getErrorMessage(langues.error)}</Alert>
        ) : !langues.data ? (
          <div className="flex justify-center py-6 text-content-secondary">
            <Loader2 className="animate-spin" aria-label="Chargement des langues" />
          </div>
        ) : langues.data.length === 0 ? (
          <p className="p-4 text-content-secondary">
            Aucune langue n&apos;existe encore.{" "}
            <Link href={ROUTES.admin.langues} className="font-semibold text-primary hover:underline">
              Ajoutez-les dans Langues et niveaux
            </Link>
            .
          </p>
        ) : (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto">
            {langues.data.map((l) => (
              <li key={l.idLangue}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-background/60">
                  <input
                    type="checkbox"
                    checked={choisies.includes(l.idLangue)}
                    onChange={(e) =>
                      onChange(e.target.checked ? [...choisies, l.idLangue] : choisies.filter((id) => id !== l.idLangue))
                    }
                    className="h-4 w-4 shrink-0 cursor-pointer rounded accent-primary"
                  />
                  <span className="text-content">{l.libelle}</span>
                  <span className="ml-auto text-small text-content-secondary">{l.code.toUpperCase()}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p id="formateur-langues-message" className="msg-error mt-1.5">
          {error}
        </p>
      )}
    </fieldset>
  );
}
