export interface PasswordRule {
  id: string;
  label: string;
  /** Une règle obligatoire bloque la validation du formulaire. */
  required: boolean;
  test: (password: string) => boolean;
}

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `${PASSWORD_MIN_LENGTH} caractères minimum`,
    required: true,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "case",
    label: "Une majuscule et une minuscule",
    required: true,
    test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  },
  { id: "digit", label: "Un chiffre", required: true, test: (p) => /\d/.test(p) },
  { id: "special", label: "Un caractère spécial", required: false, test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export type StrengthLevel = "empty" | "weak" | "medium" | "good" | "strong";

export const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  empty: "",
  weak: "faible",
  medium: "moyenne",
  good: "bonne",
  strong: "forte",
};

export interface PasswordStrength {
  /** Nombre de règles respectées (0 à PASSWORD_RULES.length). */
  score: number;
  level: StrengthLevel;
  passed: Record<string, boolean>;
}

export function getPasswordStrength(password: string): PasswordStrength {
  const passed = Object.fromEntries(PASSWORD_RULES.map((r) => [r.id, r.test(password)]));
  const score = Object.values(passed).filter(Boolean).length;
  const levels: StrengthLevel[] = ["weak", "weak", "medium", "good", "strong"];
  return { score, level: password ? levels[score] : "empty", passed };
}

/** Renvoie le premier message d'erreur bloquant, ou undefined si le mot de passe est valide. */
export function validatePassword(password: string): string | undefined {
  if (!password) return "Le mot de passe est requis.";
  const failed = PASSWORD_RULES.find((r) => r.required && !r.test(password));
  return failed ? `Le mot de passe doit contenir : ${failed.label.toLowerCase()}.` : undefined;
}
