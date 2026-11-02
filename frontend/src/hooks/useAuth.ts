"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ACCUEIL_PAR_ROLE } from "@/lib/navigation";
import { ROUTES } from "@/lib/routes";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { useTestDiagnosticStore } from "@/store/test-diagnostic.store";
import type { LoginFormValues } from "@/types/auth";

/*
 * Hooks d'authentification : relient le service (appels HTTP), le store (session)
 * et la navigation. Les composants n'utilisent que ces hooks.
 */

/**
 * Connexion : en cas de succès, le JWT est enregistré (localStorage si « Se souvenir de moi »,
 * sinon sessionStorage) puis l'utilisateur est redirigé vers l'accueil de son espace, selon son rôle.
 * Le cache est vidé avant : aucune donnée d'un compte précédent ne doit s'afficher.
 */
export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({ email, motDePasse }: LoginFormValues) => authService.login({ email, motDePasse }),
    onSuccess: (session, { seSouvenir }) => {
      queryClient.removeQueries();
      setSession(session, seSouvenir);
      router.push(ACCUEIL_PAR_ROLE[session.utilisateur.role]);
    },
  });
}

/** Le composant affiche lui-même le message de succès (critère d'acceptation). */
export function useRegister() {
  return useMutation({ mutationFn: authService.register });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authService.forgotPassword });
}

export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: authService.resetPassword,
    onSuccess: () => router.push(`${ROUTES.login}?reset=success`),
  });
}

/** Déconnexion : la session et les données en cache (profil, listes…) sont effacées. */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);

  return useCallback(() => {
    clearSession();
    useTestDiagnosticStore.getState().reinitialiser();
    queryClient.removeQueries();
    router.push(ROUTES.login);
  }, [clearSession, queryClient, router]);
}
