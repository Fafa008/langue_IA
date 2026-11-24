"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { configureApiClient, isRetryable } from "@/lib/api-client";
import { COMPTE_DEMO_EMAIL, COMPTE_DEMO_MOT_DE_PASSE } from "@/lib/demo";
import { DEMO } from "@/lib/env";
import { httpAuthService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { useTestDiagnosticStore } from "@/store/test-diagnostic.store";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Une seule nouvelle tentative, et seulement pour une panne (réseau, 5xx) : jamais pour un 4xx
      queries: { retry: (failureCount, error) => failureCount < 1 && isRetryable(error) },
    },
  });
}

/* Une seule connexion démo par chargement de page, même si React monte plusieurs fois le provider. */
let connexionDemo: Promise<void> | null = null;

function connecterLeCompteDemo(): Promise<void> {
  if (!DEMO || useAuthStore.getState().accessToken) return Promise.resolve();
  connexionDemo ??= httpAuthService
    .login({ email: COMPTE_DEMO_EMAIL, motDePasse: COMPTE_DEMO_MOT_DE_PASSE })
    .then((session) => useAuthStore.getState().setSession(session, false))
    .catch(() => {
      // Backend indisponible : la page de connexion reste utilisable (auth réelle) pour réessayer.
    })
    .finally(() => {
      connexionDemo = null;
    });
  return connexionDemo;
}

export default function Providers({ children }: { children: ReactNode }) {
  // Initialisé pendant le premier rendu : le client HTTP est prêt avant la première requête
  const [client] = useState(() => {
    const queryClient = createQueryClient();
    configureApiClient({
      getToken: () => useAuthStore.getState().accessToken,
      // JWT refusé (expiré, compte suspendu) : session effacée, cache purgé et retour explicite à la connexion.
      onUnauthorized: () => {
        useAuthStore.getState().clearSession();
        useTestDiagnosticStore.getState().reinitialiser();
        queryClient.clear();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.assign("/login?session=expiree");
        }
      },
    });
    return queryClient;
  });

  useEffect(() => {
    if (!DEMO) return;
    void connecterLeCompteDemo().then(() => {
      if (useAuthStore.getState().accessToken && window.location.pathname === "/login") {
        window.location.replace("/espace/apprenant");
      }
    });
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
