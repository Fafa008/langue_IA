"use client";
import { Camera, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Alert from "@/components/ui/Alert";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { useSupprimerPhoto, useUploadPhoto } from "@/hooks/useProfil";
import { getErrorMessage } from "@/lib/api-client";
import { PHOTO_ACCEPT, reduirePhoto, validatePhoto } from "@/lib/photo";
import type { Utilisateur } from "@/types/utilisateur";

const PHOTO_ERRORS = {
  413: "L'image est trop lourde pour le serveur.",
  415: "Ce format d'image n'est pas accepté.",
};

interface Apercu {
  photo: Blob;
  url: string;
}

interface ProfilPhotoProps {
  utilisateur: Utilisateur;
  /** Reçoit le message de confirmation à afficher. */
  onSaved: (message: string) => void;
}

/**
 * Photo de profil : choix d'une image, contrôle (format, taille), aperçu, puis envoi.
 * L'image est réduite avant l'envoi (voir lib/photo).
 */
export default function ProfilPhoto({ utilisateur, onSaved }: ProfilPhotoProps) {
  const input = useRef<HTMLInputElement>(null);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const upload = useUploadPhoto();
  const supprimer = useSupprimerPhoto();

  // L'URL locale de l'aperçu est libérée quand elle n'est plus affichée
  useEffect(() => () => {
    if (apercu) URL.revokeObjectURL(apercu.url);
  }, [apercu]);

  async function choisir(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de rechoisir le même fichier
    if (!file) return;
    upload.reset();
    supprimer.reset();

    const invalide = validatePhoto(file);
    if (invalide) {
      setApercu(null);
      return setErreur(invalide);
    }
    try {
      const photo = await reduirePhoto(file);
      setErreur(null);
      setApercu({ photo, url: URL.createObjectURL(photo) });
    } catch {
      setApercu(null);
      setErreur("Cette image est illisible. Choisissez-en une autre.");
    }
  }

  function enregistrer() {
    if (!apercu) return;
    upload.mutate(apercu.photo, {
      onSuccess: () => {
        setApercu(null);
        onSaved("Photo de profil mise à jour.");
      },
    });
  }

  function annuler() {
    setApercu(null);
    upload.reset();
  }

  const erreurServeur = upload.error ?? supprimer.error;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <Avatar
          prenom={utilisateur.prenom}
          nom={utilisateur.nom}
          photoUrl={apercu?.url ?? utilisateur.photoUrl}
          size={176}
        />
        {!apercu && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            aria-label="Changer la photo"
            title="Changer la photo"
            className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full border-4 border-surface bg-primary text-white shadow-card transition-colors hover:bg-primary-dark"
          >
            <Camera size={18} aria-hidden />
          </button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        onChange={choisir}
        aria-label="Choisir une photo de profil"
        className="sr-only"
        tabIndex={-1}
      />

      {apercu ? (
        <div className="mt-5 flex w-full flex-col gap-2">
          <p className="text-small text-content-secondary">Aperçu de votre nouvelle photo</p>
          <Button type="button" onClick={enregistrer} loading={upload.isPending} fullWidth>
            Enregistrer la photo
          </Button>
          <Button type="button" variant="secondary" onClick={annuler} disabled={upload.isPending} fullWidth>
            Annuler
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-small text-content-secondary">JPEG, PNG ou WebP, 2 Mo maximum.</p>
          {utilisateur.photoUrl && (
            <button
              type="button"
              onClick={() => supprimer.mutate(undefined, { onSuccess: () => onSaved("Photo de profil supprimée.") })}
              disabled={supprimer.isPending}
              className="mt-2 inline-flex items-center gap-1.5 text-small font-semibold text-content-secondary hover:text-error disabled:opacity-50"
            >
              <Trash2 size={14} aria-hidden />
              Supprimer la photo
            </button>
          )}
        </>
      )}

      {erreur && <Alert className="mt-4 w-full text-left">{erreur}</Alert>}
      {erreurServeur && <Alert className="mt-4 w-full text-left">{getErrorMessage(erreurServeur, PHOTO_ERRORS)}</Alert>}
    </div>
  );
}
