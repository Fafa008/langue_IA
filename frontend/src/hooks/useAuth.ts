"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import type { LoginFormValues } from "@/types/auth";

/*
 * Hooks d'authentification : relient le service (appels HTTP), le store (session)
 * et la navigation. Les composants n'utilisent que ces hooks.
 */

export function useLogin() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({ email, motDePasse }: LoginFormValues) => authService.login({ email, motDePasse }),
    onSuccess: (session, { seSouvenir }) => {
      setSession(session, seSouvenir);
      router.push(ROUTES.afterLogin);
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

export function useLogout() {
  const router = useRouter();
  const clearSession = useAuthStore((s) => s.clearSession);

  return () => {
    clearSession();
    router.push(ROUTES.login);
  };
}
