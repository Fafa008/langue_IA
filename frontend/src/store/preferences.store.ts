import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CodeLangue } from "@/types/langue";

interface PreferencesState {
  /** Langue d'affichage choisie dans l'en-tête. */
  langueInterface: CodeLangue;
  setLangueInterface: (langue: CodeLangue) => void;
}

/** Préférences d'affichage propres au navigateur, conservées d'une visite à l'autre (localStorage). */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      langueInterface: "fr",
      setLangueInterface: (langueInterface) => set({ langueInterface }),
    }),
    {
      name: "digitheque-preferences",
      storage: createJSONStorage(() => localStorage),
      // Relu après le premier rendu (LanguageSwitcher) : le HTML du serveur et du navigateur restent identiques
      skipHydration: true,
    },
  ),
);
