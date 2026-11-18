import type { ReactNode } from "react";

/** Regroupe des champs sous un titre (« Vos informations », « Sécurité »…). */
export default function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6 first-of-type:mt-0">
      <legend className="eyebrow">{title}</legend>
      {children}
    </fieldset>
  );
}
