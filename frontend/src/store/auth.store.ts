import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isJwtExpired } from "@/lib/jwt";
import { rememberAwareStorage } from "@/lib/storage";
import type { AuthSession } from "@/types/auth";
import type { Utilisateur } from "@/types/utilisateur";

interface AuthState {
  utilisateur: Utilisateur | null;
  accessToken: string | null;
  remember: boolean;
  setSession: (session: AuthSession, remember: boolean) => void;
  clearSession: () => void;
  /** Remplace les données de l'utilisateur connecté (après une modification du profil). */
  setUtilisateur: (utilisateur: Utilisateur) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      utilisateur: null,
      accessToken: null,
      remember: false,
      setSession: ({ utilisateur, accessToken }, remember) => set({ utilisateur, accessToken, remember }),
      clearSession: () => set({ utilisateur: null, accessToken: null, remember: false }),
      setUtilisateur: (utilisateur) => set({ utilisateur }),
    }),
    {
      name: "digitheque-auth",
      storage: createJSONStorage(() => rememberAwareStorage),
      partialize: ({ utilisateur, accessToken, remember }) => ({ utilisateur, accessToken, remember }),
      // Au rechargement de la page, une session dont le JWT a expiré est effacée
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken && isJwtExpired(state.accessToken)) state.clearSession();
      },
    },
  ),
);

export const selectIsAuthenticated = (s: AuthState) => s.accessToken !== null && !isJwtExpired(s.accessToken);
