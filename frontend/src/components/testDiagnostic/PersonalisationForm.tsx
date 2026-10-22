import type {
  CreneauPresence,
  ObjectifFormation,
  PersonnalisationTest,
} from "@/types/test-diagnostic";
import {
  BriefcaseBusiness,
  CalendarDays,
  GraduationCap,
  Moon,
  Plane,
  Sun,
  Sunrise,
  Target,
  type LucideIcon,
} from "lucide-react";

const OBJECTIFS: { id: ObjectifFormation; titre: string; Icone: LucideIcon }[] = [
  { id: "professionnel", titre: "Professionnel / Business", Icone: BriefcaseBusiness },
  { id: "personnel", titre: "Personnel / Voyage", Icone: Plane },
  { id: "scolaire", titre: "Scolaire / Examens", Icone: GraduationCap },
];

const CRENEAUX: { id: CreneauPresence; titre: string; horaire: string; Icone: LucideIcon }[] = [
  { id: "matin", titre: "Matinée", horaire: "8h – 12h", Icone: Sunrise },
  { id: "apres_midi", titre: "Après-midi", horaire: "14h – 18h", Icone: Sun },
  { id: "soiree", titre: "Soirée", horaire: "18h – 21h", Icone: Moon },
];

interface PersonalisationFormProps {
  value: PersonnalisationTest;
  disabled: boolean;
  onChange: (value: PersonnalisationTest) => void;
}

export default function PersonalisationForm({ value, disabled, onChange }: PersonalisationFormProps) {
  const choisirCreneau = (creneau: CreneauPresence) => {
    const creneaux = value.creneaux.includes(creneau)
      ? value.creneaux.filter((item) => item !== creneau)
      : [...value.creneaux, creneau];
    onChange({ ...value, creneaux });
  };

  return (
    <div className="space-y-6">
      <fieldset disabled={disabled}>
        <legend className="mb-3 flex items-center gap-2 font-semibold">
          <Target aria-hidden="true" size={18} />
          Quel est l’objectif principal de votre formation ?
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OBJECTIFS.map(({ id, titre, Icone }) => (
            <label
              key={id}
              className={`flex cursor-pointer items-center gap-3 rounded-btn border bg-surface p-4 ${
                value.objectif === id ? "border-primary ring-1 ring-primary" : "border-border hover:bg-background"
              }`}
            >
              <input
                type="radio"
                name="objectif-formation"
                value={id}
                checked={value.objectif === id}
                onChange={() => onChange({ ...value, objectif: id })}
                className="h-4 w-4 accent-primary"
              />
              <Icone aria-hidden="true" size={20} className="shrink-0 text-primary" />
              <span className="font-semibold">{titre}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend className="mb-3 flex items-center gap-2 font-semibold">
          <CalendarDays aria-hidden="true" size={18} />
          Quels sont vos créneaux habituels au centre ?
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {CRENEAUX.map(({ id, titre, horaire, Icone }) => {
            const checked = value.creneaux.includes(id);
            return (
              <label
                key={id}
                className={`flex cursor-pointer items-center gap-2 rounded-btn border px-3 py-3 ${
                  checked ? "border-primary ring-1 ring-primary" : "border-border hover:bg-background"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => choisirCreneau(id)}
                  className="h-4 w-4 accent-primary"
                />
                <Icone aria-hidden="true" size={20} className="shrink-0 text-primary" />
                <span className="text-small font-semibold">{titre}<span className="block font-normal text-content-secondary">{horaire}</span></span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
