import type { ReactNode } from "react";
import Header from "@/components/Header";
import AppSidebar from "@/components/layout/AppSidebar";
import RequireAuth from "@/components/layout/RequireAuth";

/** Gabarit de l'espace connecté (apprenant, formateur, administrateur) : en-tête, navigation latérale et contenu. */
export default function EspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
          <RequireAuth>{children}</RequireAuth>
        </main>
      </div>
    </div>
  );
}
