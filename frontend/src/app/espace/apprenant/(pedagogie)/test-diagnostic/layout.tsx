import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Test diagnostic – Digithèque" };

/** Gabarit commun aux pages du module Diagnostic (démarrage, test, résultats) ; l'accès apprenant est vérifié par le layout parent. */
export default function TestDiagnosticLayout({ children }: { children: ReactNode }) {
  return <div className="container-page py-10 md:py-14">{children}</div>;
}
