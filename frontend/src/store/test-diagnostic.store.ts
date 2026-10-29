import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { etatInitial, reducteur } from "@/lib/testAdaptatif";
import type { CodeLangue } from "@/types/langue";
import type { ActionTest, EtatTest } from "@/types/test-diagnostic";

interface TestDiagnosticState {
  etat: EtatTest;
  /** Seule porte d'entrée des transitions : les règles restent dans le réducteur pur (lib/testAdaptatif). */
  dispatch: (action: ActionTest) => void;
  /** Efface le test en cours (déconnexion, changement d'utilisateur). */
  reinitialiser: () => void;
}

/** Langue proposée tant que ni l'URL ni le profil n'en indiquent une. */
export const LANGUE_PAR_DEFAUT: CodeLangue = "en";

/**
 * Store unique du test de positionnement, partagé par les pages démarrage, test et résultats.
 * Il est conservé dans sessionStorage pour survivre à un rechargement de page ; l'enregistrement
 * audio (Blob) n'est pas sérialisable et n'est donc pas conservé.
 */
export const useTestDiagnosticStore = create<TestDiagnosticState>()(
  persist(
    (set) => ({
      etat: etatInitial(LANGUE_PAR_DEFAUT),
      dispatch: (action) => set((s) => ({ etat: reducteur(s.etat, action) })),
      reinitialiser: () => set({ etat: etatInitial(LANGUE_PAR_DEFAUT) }),
    }),
    {
      name: "digitheque-test-diagnostic",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ etat }) => ({ etat: { ...etat, audioEnregistre: null } }),
    },
  ),
);

/** Un test est en cours tant qu'une question est affichée ou corrigée. */
export const selectTestEnCours = (s: TestDiagnosticState) =>
  (s.etat.phase === "question" || s.etat.phase === "retour") && s.etat.sessionId !== null && s.etat.courante !== null;
