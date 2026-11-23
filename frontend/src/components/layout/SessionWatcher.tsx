"use client";
import { useProfil } from "@/hooks/useProfil";
import { useSession } from "@/hooks/useSession";

/**
 * Relit `/users/me` au retour d'onglet : le JWT ne porte que `sub`/`usage`, le rôle et le statut
 * étant relus en base à chaque requête, une suspension prend effet sans attendre une action de l'utilisateur.
 */
export default function SessionWatcher() {
  const { isAuthenticated } = useSession();
  useProfil(isAuthenticated);
  return null;
}
