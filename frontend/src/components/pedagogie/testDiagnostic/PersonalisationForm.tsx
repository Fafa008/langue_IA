import FormField from "@/components/ui/FormField";
import Select from "@/components/ui/Select";
import type {
  CreneauPresence,
  ObjectifFormation,
  PersonnalisationTest,
} from "@/types/test-diagnostic";
import { CalendarIcon, Target } from "lucide-react";

const OBJECTIFS: { value: ObjectifFormation; label: string }[] = [
  { value: "professionnel", label: "Professionnel / Business" },
  { value: "personnel", label: "Personnel / Voyage" },
  { value: "scolaire", label: "Scolaire / Examens" },
];

const CRENEAUX: { value: CreneauPresence; label: string }[] = [
  { value: "matin", label: "Matinée (8h – 12h)" },
  { value: "apres_midi", label: "Après-midi (14h – 18h)" },
  { value: "soiree", label: "Soirée (18h – 21h)" },
];

interface PersonalisationFormProps {
  value: PersonnalisationTest;
  disabled: boolean;
  onChange: (value: PersonnalisationTest) => void;
}

export default function PersonalisationForm({ value, disabled, onChange }: PersonalisationFormProps) {
  return (
    <div className="space-y-2">
      <FormField
        id="objectif-formation"
        className="mt-0"
        label={
          <span className="flex items-center gap-2 font-semibold">
            <Target aria-hidden="true" size={18} />
            Quel est l’objectif principal de votre formation ?
          </span>
        }
      >
        {(control) => (
          <Select
            {...control}
            disabled={disabled}
            options={OBJECTIFS}
            value={value.objectif}
            onChange={(e) => onChange({ ...value, objectif: e.target.value as ObjectifFormation })}
          />
        )}
      </FormField>

      <FormField
        id="creneau-presence"
        label={
          <span className="flex items-center gap-2 font-semibold">
            <CalendarIcon aria-hidden="true" size={18} />
            Quel est votre créneau habituel au centre ?
          </span>
        }
      >
        {(control) => (
          <Select
            {...control}
            disabled={disabled}
            placeholder="Choisissez un créneau"
            options={CRENEAUX}
            value={value.creneaux[0] ?? ""}
            onChange={(e) => onChange({ ...value, creneaux: [e.target.value as CreneauPresence] })}
          />
        )}
      </FormField>
    </div>
  );
}
