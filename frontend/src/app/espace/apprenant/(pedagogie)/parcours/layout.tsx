import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Mon parcours – Digithèque" };

/** Gabarit de « Mon parcours », de ses modules et de ses leçons ; l'accès apprenant est vérifié par le layout parent. */
export default function ParcoursLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl py-2 md:py-4">{children}</div>;
}
