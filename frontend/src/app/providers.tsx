"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { configureApiClient, isRetryable } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Une seule nouvelle tentative, et seulement pour une panne (réseau, 5xx) : jamais pour un 4xx
      queries: { retry: (failureCount, error) => failureCount < 1 && isRetryable(error) },
    },
  });
}

export default function Providers({ children }: { children: ReactNode }) {
  // Initialisé pendant le premier rendu : le client HTTP est prêt avant la première requête
  const [client] = useState(() => {
    const queryClient = createQueryClient();
    configureApiClient({
      getToken: () => useAuthStore.getState().accessToken,
      // JWT refusé (expiré, révoqué) : la session est effacée et les pages protégées
      // redirigent vers la connexion (voir components/layout/RequireAuth)
      onUnauthorized: () => {
        useAuthStore.getState().clearSession();
        queryClient.clear();
      },
    });
    return queryClient;
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
