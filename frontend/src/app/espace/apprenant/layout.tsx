import type { ReactNode } from "react";
import RequireAuth from "@/components/layout/RequireAuth";

/** Pages de l'apprenant : réservées au rôle APPRENANT. */
export default function ApprenantLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["APPRENANT"]}>{children}</RequireAuth>;
}
