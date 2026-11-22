import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  children: ReactNode;
  /** `titre` conserve le style des grands titres de la page Profil ; `eyebrow` est le style des formulaires d'authentification. */
  variant?: "eyebrow" | "titre";
}

/** Regroupe des champs sous un titre (« Vos informations », « Sécurité »…). */
export default function FormSection({ title, children, variant = "eyebrow" }: FormSectionProps) {
  if (variant === "titre") {
    return (
      <section aria-label={title}>
        <h2 className="text-h3 text-primary">{title}</h2>
        {children}
      </section>
    );
  }
  return (
    <fieldset className="mt-6 first-of-type:mt-0">
      <legend className="eyebrow">{title}</legend>
      {children}
    </fieldset>
  );
}
