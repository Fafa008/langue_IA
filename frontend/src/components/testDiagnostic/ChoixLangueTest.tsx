import Image from "next/image";
import { LANGUES } from "@/lib/languages";
import type { CodeLangue } from "@/types/langue";

interface ChoixLangueTestProps {
  value: CodeLangue;
  onChange: (code: CodeLangue) => void;
  disabled?: boolean;
}

/** Langue du test : préselectionnée par la page, modifiable avant le démarrage. */
export default function ChoixLangueTest({ value, onChange, disabled = false }: ChoixLangueTestProps) {
  return (
    <div role="radiogroup" aria-label="Langue du test" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {LANGUES.map(({ code, libelle, flag }) => {
        const selectionnee = code === value;
        return (
          <label
            key={code}
            data-testid={`language-option-${code}`}
            className={`card flex flex-col items-center gap-2 p-4 text-center transition-colors ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-background"
            } ${
              selectionnee ? "border-primary ring-1 ring-primary" : ""
            }`}
          >
            <input
              type="radio"
              name="langue-test"
              value={code}
              checked={selectionnee}
              disabled={disabled}
              onChange={() => onChange(code)}
              className="sr-only"
            />
            <Image
              src={flag}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover shadow-card ring-1 ring-border"
            />
            <span className="text-small font-semibold text-primary">{libelle}</span>
            {selectionnee && <span className="msg-success">Votre choix</span>}
          </label>
        );
      })}
    </div>
  );
}