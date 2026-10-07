import Image from "next/image";
import FieldGroup from "@/components/ui/FieldGroup";
import { LANGUES } from "@/lib/languages";
import type { CodeLangue } from "@/types/langue";

interface LanguePickerProps {
  value: CodeLangue[];
  onChange: (value: CodeLangue[]) => void;
  error?: string;
}

/** Choix d'une ou plusieurs langues, présentées sous forme de pastilles à cocher. */
export default function LanguePicker({ value, onChange, error }: LanguePickerProps) {
  const toggle = (code: CodeLangue) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  return (
    <FieldGroup id="langues" legend="Langues souhaitées" hint="Choisissez au moins une langue." error={error}>
      <div className="flex flex-wrap gap-2">
        {LANGUES.map((langue) => (
          <label key={langue.code} className="cursor-pointer">
            <input
              type="checkbox"
              name="langues"
              value={langue.code}
              checked={value.includes(langue.code)}
              onChange={() => toggle(langue.code)}
              className="peer sr-only"
            />
            <span
              className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 font-medium transition-colors
                peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white
                peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary
                ${error ? "border-error" : "border-border hover:border-primary"}`}
            >
              <Image src={langue.flag} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
              {langue.libelle}
            </span>
          </label>
        ))}
      </div>
    </FieldGroup>
  );
}
