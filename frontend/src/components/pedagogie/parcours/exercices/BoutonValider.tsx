import { Send } from "lucide-react";

export default function BoutonValider({ desactive, enCours, libelle = "Valider ma réponse" }: { desactive: boolean; enCours: boolean; libelle?: string }) {
  return (
    <button type="submit" disabled={desactive || enCours} className="btn-primary mt-4 px-5 py-2.5 disabled:opacity-50">
      <Send size={16} aria-hidden /> {enCours ? "Correction en cours…" : libelle}
    </button>
  );
}
