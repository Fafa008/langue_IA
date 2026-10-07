import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { rememberAwareStorage } from "@/lib/storage";
import type { AuthSession } from "@/types/auth";
import type { Utilisateur } from "@/types/utilisateur";

interface AuthState {
  utilisateur: Utilisateur | null;
  accessToken: string | null;
  remember: boolean;
  setSession: (session: AuthSession, remember: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      utilisateur: null,
      accessToken: null,
      remember: false,
      setSession: ({ utilisateur, accessToken }, remember) => set({ utilisateur, accessToken, remember }),
      clearSession: () => set({ utilisateur: null, accessToken: null, remember: false }),
    }),
    {
      name: "digitheque-auth",
      storage: createJSONStorage(() => rememberAwareStorage),
      partialize: ({ utilisateur, accessToken, remember }) => ({ utilisateur, accessToken, remember }),
    },
  ),
);

export const selectIsAuthenticated = (s: AuthState) => s.accessToken !== null;
