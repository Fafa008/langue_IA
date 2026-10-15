import type { ReactNode } from "react";
import RequireAuth from "@/components/layout/RequireAuth";

/** Pages d'administration : réservées au rôle ADMINISTRATEUR. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["ADMINISTRATEUR"]}>{children}</RequireAuth>;
}
