import type { ReactNode } from "react";
import RequireAuth from "@/components/layout/RequireAuth";

/** Pages du formateur : réservées au rôle FORMATEUR. */
export default function FormateurLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["FORMATEUR"]}>{children}</RequireAuth>;
}
