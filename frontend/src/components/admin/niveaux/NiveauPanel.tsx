"use client";
import { Layers, Save } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import SidePanel from "@/components/ui/SidePanel";
import { useForm } from "@/hooks/useForm";
import { useCreerNiveau, useModifierNiveau } from "@/hooks/useNiveaux";
import { ApiError, HTTP_STATUS, getErrorMessage } from "@/lib/api-client";
import { NIVEAU_CODE_MAX_LONGUEUR, formatCodeNiveau } from "@/lib/niveaux";
import { normaliserEspaces } from "@/lib/saisie";
import { validateNiveau } from "@/lib/validation/niveau";
import type { Niveau, NiveauFormValues } from "@/types/langue";

const ERREURS = {
  [HTTP_STATUS.CONFLICT]: "Ce code est déjà utilisé par un autre niveau.",
};

const toFormValues = (niveau: Niveau | null): NiveauFormValues =>
  niveau ? { code: niveau.code, libelle: niveau.libelle } : { code: "", libelle: "" };

interface NiveauPanelProps {
  /** null : création d'un nouveau niveau. */
  niveau: Niveau | null;
  onClose: () => void;
  onSaved: (niveau: Niveau) => void;
}

/** Ajout ou modification d'un niveau : code et libellé. */
export default function NiveauPanel({ niveau, onClose, onSaved }: NiveauPanelProps) {
  const creer = useCreerNiveau();
  const modifier = useModifierNiveau();
  const mutation = niveau ? modifier : creer;

  const form = useForm({
    initialValues: toFormValues(niveau),
    validate: validateNiveau,
    onSubmit: (v) => {
      const payload = { code: normaliserEspaces(v.code), libelle: normaliserEspaces(v.libelle) };
      if (niveau) modifier.mutate({ idNiveau: niveau.idNiveau, payload }, { onSuccess: onSaved });
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
    <SidePanel title={niveau ? "Modifier le niveau" : "Ajouter un niveau"} icon={Layers} onClose={onClose} locked={mutation.isPending}>
      <form onSubmit={handleSubmit} noValidate>
        {mutation.isError && <Alert className="mt-4">{getErrorMessage(mutation.error, ERREURS)}</Alert>}

        <FormField id="niveau-code" label="Code *" error={errors.code} hint="Ex. : A1, B2, HSK 3">
          {({ invalid, ...field }) => (
            <Input
              {...field}
              invalid={invalid || codePris}
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={NIVEAU_CODE_MAX_LONGUEUR}
              placeholder="Ex. : A1"
              format={formatCodeNiveau}
              value={values.code}
              onChange={(e) => setField("code", e.target.value)}
            />
          )}
        </FormField>

        <FormField id="niveau-libelle" label="Libellé *" error={errors.libelle}>
          {(field) => (
            <Input {...field} placeholder="Ex. : Débutant" value={values.libelle} onChange={(e) => setField("libelle", e.target.value)} />
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
