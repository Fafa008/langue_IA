import type { DonneeAnalyse, FormatExercice } from "@/types/test-diagnostic";

const FORMATS: Record<FormatExercice, string> = {
  qcm: "QCM",
  vrai_faux: "Vrai / faux",
  texte_a_trous: "Texte à trous",
  dictee: "Dictée",
  parler: "Expression orale",
};

const COMPETENCES: Record<string, string> = {
  grammaire: "Grammaire",
  lecture: "Lire",
  ecoute: "Écouter",
  ecrit: "Écrire",
  oral: "Parler",
};

/**
 * Dossier transmis à l'agent diagnostic. L'agent interprète ces faits : il ne calcule ni la note
 * sur 100, ni la pondération. La section n'apparaît que si le service fournit ces données.
 */
export default function DonneesAnalyse({ donnees }: { donnees: DonneeAnalyse[] }) {
  if (donnees.length === 0) return null;
  return (
    <section className="card" aria-labelledby="donnees-analyse-title" data-testid="donnees-analyse">
      <h2 id="donnees-analyse-title" className="text-h5 font-semibold text-content">Données transmises à l&apos;analyse</h2>
      <p className="mt-1 text-small text-content-secondary">
        Chaque ligne correspond à un exercice. L&apos;agent se contente d&apos;interpréter ces résultats.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-small">
          <thead>
            <tr className="border-b border-border text-content-secondary">
              <th scope="col" className="py-2 pr-4">Exercice</th>
              <th scope="col" className="py-2 pr-4">Compétence</th>
              <th scope="col" className="py-2 pr-4">Format</th>
              <th scope="col" className="py-2 pr-4">Difficulté</th>
              <th scope="col" className="py-2 pr-4">Réponse</th>
              <th scope="col" className="py-2">Temps</th>
            </tr>
          </thead>
          <tbody>
            {donnees.map((donnee) => (
              <tr key={donnee.idQuestion} className="border-b border-border/60" data-testid={`donnee-analyse-${donnee.idQuestion}`}>
                <td className="py-2 pr-4 font-mono">{donnee.idQuestion}</td>
                <td className="py-2 pr-4">{COMPETENCES[donnee.competence] ?? donnee.competence}</td>
                <td className="py-2 pr-4">{FORMATS[donnee.format]}</td>
                <td className="py-2 pr-4">{donnee.difficulte}</td>
                <td className="py-2 pr-4">{donnee.justesse ? "Correcte" : "Incorrecte"}</td>
                <td className="py-2">{donnee.tempsReponseSecondes} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
