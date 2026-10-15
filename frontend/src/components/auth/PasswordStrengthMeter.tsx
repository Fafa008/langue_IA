import { Check, Circle } from "lucide-react";
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES, STRENGTH_LABELS, getPasswordStrength, type StrengthLevel } from "@/lib/password";

const BAR_COLORS: Record<StrengthLevel, string> = {
  empty: "bg-border",
  weak: "bg-error",
  medium: "bg-warning",
  good: "bg-success",
  strong: "bg-success",
};

interface PasswordStrengthMeterProps {
  password: string;
  /** Affiche la liste détaillée des règles (écran « Nouveau mot de passe »). */
  showRules?: boolean;
}

export default function PasswordStrengthMeter({ password, showRules = false }: PasswordStrengthMeterProps) {
  const { score, level, passed } = getPasswordStrength(password);

  return (
    <div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {PASSWORD_RULES.map((rule, i) => (
          <span key={rule.id} className={`h-1 flex-1 rounded-full ${i < score ? BAR_COLORS[level] : "bg-border"}`} />
        ))}
      </div>

      {showRules ? (
        <ul className="mt-3 space-y-1 text-[0.8125rem]" aria-label="Règles du mot de passe">
          {PASSWORD_RULES.map((rule) => {
            const ok = passed[rule.id];
            const Icon = ok ? Check : Circle;
            return (
              <li key={rule.id} className={`flex items-center gap-2 ${ok ? "text-success" : "text-content-secondary"}`}>
                <Icon size={14} aria-hidden />
                {rule.label}
                {!rule.required && <span className="text-content-secondary">(recommandé)</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1.5 text-small text-content-secondary" aria-live="polite">
          {level !== "empty" && `Force : ${STRENGTH_LABELS[level]} · `}
          {PASSWORD_MIN_LENGTH} caractères minimum
        </p>
      )}
    </div>
  );
}
