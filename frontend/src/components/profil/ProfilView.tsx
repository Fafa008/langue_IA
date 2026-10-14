"use client";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import Alert from "@/components/ui/Alert";
import Toast from "@/components/ui/Toast";
import { useProfil } from "@/hooks/useProfil";
import { getErrorMessage } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/roles";
import ProfilForm from "./ProfilForm";
import ProfilPhoto from "./ProfilPhoto";

/** Page « Mon profil » : charge le profil puis affiche l'identité de l'utilisateur et le formulaire prérempli. */
export default function ProfilView() {
  const router = useRouter();
  const profil = useProfil();
  const [toast, setToast] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  return (
    <div className="mx-auto max-w-5xl">
      {toast && <Toast onClose={closeToast}>{toast}</Toast>}

      <div className="mb-8 flex items-start gap-5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Retour"
          className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-surface text-content shadow-card hover:text-primary"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <div>
          <h1>Mon profil</h1>
          <p className="mt-1 text-base text-content-secondary">
            Gérez vos informations personnelles et personnalisez votre compte.
          </p>
        </div>
      </div>

      <section className="card grid gap-8 p-6 sm:p-8 md:grid-cols-[15.5rem_1fr] md:gap-0">
        {profil.data ? (
          <>
            <div className="flex flex-col items-center text-center md:border-r md:border-border md:pr-8">
              <ProfilPhoto utilisateur={profil.data} onSaved={setToast} />
              <p className="mt-6 text-h4 font-semibold text-content">
                {profil.data.prenom} {profil.data.nom}
              </p>
              <p className="mt-1 text-content-secondary">{ROLE_LABELS[profil.data.role]}</p>
            </div>
            {/* key : le formulaire repart des données du serveur si l'utilisateur change */}
            <ProfilForm
              key={profil.data.idUser}
              utilisateur={profil.data}
              onSaved={() => setToast("Profil mis à jour avec succès.")}
            />
          </>
        ) : profil.isError ? (
          <div className="md:col-span-2">
            <Alert>{getErrorMessage(profil.error)}</Alert>
          </div>
        ) : (
          <div className="flex justify-center py-16 text-content-secondary md:col-span-2">
            <Loader2 className="animate-spin" aria-label="Chargement du profil" />
          </div>
        )}
      </section>
    </div>
  );
}
