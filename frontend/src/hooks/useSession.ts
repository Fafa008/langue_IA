"use client";
import { useEffect, useState } from "react";
import { selectIsAuthenticated, useAuthStore } from "@/store/auth.store";

/**
 * Session lue côté navigateur. Le rendu serveur ne connaît pas le stockage local :
 * `ready` reste faux jusqu'au montage pour éviter un écart d'hydratation
 * (et une redirection vers la connexion avant que la session soit relue).
 */
export function useSession() {
  const [ready, setReady] = useState(false);
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  useEffect(() => setReady(true), []);

  return { ready, utilisateur, accessToken, isAuthenticated: ready && isAuthenticated };
}
