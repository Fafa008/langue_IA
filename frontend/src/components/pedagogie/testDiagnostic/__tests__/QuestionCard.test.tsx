import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import QuestionCard from "@/components/pedagogie/testDiagnostic/QuestionCard";
import type { Question } from "@/types/test-diagnostic";

const qcm: Question = {
  id: "en-a1-1",
  niveau: "A1",
  competence: "grammaire",
  typeReponse: "choix",
  enonce: "She ___ a student.",
  choix: ["is", "are", "am", "be"],
};

const ecoute: Question = {
  ...qcm,
  id: "en-a1-ecoute",
  competence: "ecoute",
  enonce: "Where is the speaker going?",
  choix: ["To work", "To school"],
  audioTexte: "I am going to work.",
};

const redaction: Question = {
  id: "en-ecrit",
  niveau: "A1",
  competence: "ecrit",
  typeReponse: "texte",
  enonce: "Présentez-vous en quelques phrases.",
  motsMinimum: 5,
};

const trous: Question = {
  id: "en-ecrire-1",
  niveau: "A1",
  competence: "ecrit",
  typeReponse: "texte",
  format: "texte_a_trous",
  enonce: "I live in ___ .",
  lettresMelangees: ["N", "O", "L", "D", "O", "N"],
  dureeSecondes: 45,
};

const dictee: Question = {
  id: "en-ecouter-2",
  niveau: "A1",
  competence: "ecoute",
  typeReponse: "texte",
  format: "dictee",
  enonce: "Écrivez la phrase que vous avez entendue.",
  audioTexte: "I live in London.",
};

const parler: Question = {
  id: "en-parler-1",
  niveau: "A1",
  competence: "oral",
  typeReponse: "audio",
  format: "parler",
  enonce: "I live in London.",
  dureeMinimaleSecondes: 2,
};

type Props = ComponentProps<typeof QuestionCard>;

function props(question: Question, autres: Partial<Props> = {}): Props {
  return {
    question,
    langue: "en",
    choisie: null,
    envoiEnCours: false,
    onValider: jest.fn(),
    onChoixChange: jest.fn(),
    onTexteChange: jest.fn(),
    onAudioEnregistre: jest.fn(),
    onValiderTexte: jest.fn(),
    onValiderAudio: jest.fn(),
    ...autres,
  };
}

/** QuestionCard avec l'état du choix et du texte, comme dans le déroulement du test. */
function QuestionInteractive(initiales: Props) {
  const [choisie, setChoisie] = useState<number | null>(initiales.choisie);
  const [texte, setTexte] = useState("");
  return (
    <QuestionCard
      {...initiales}
      choisie={choisie}
      reponseLibre={texte}
      onChoixChange={(choix) => { setChoisie(choix); initiales.onChoixChange(choix); }}
      onTexteChange={(valeur) => { setTexte(valeur); initiales.onTexteChange(valeur); }}
    />
  );
}

describe("QuestionCard", () => {
  it("présente une question à choix et valide la réponse cochée", () => {
    const p = props(qcm);
    render(<QuestionInteractive {...p} />);

    expect(screen.getByText("Choisissez la bonne réponse parmi les propositions.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "She ___ a student." })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);

    const valider = screen.getByRole("button", { name: "Valider et continuer" });
    expect(valider).toBeDisabled();

    fireEvent.click(screen.getByLabelText("are"));
    expect(p.onChoixChange).toHaveBeenCalledWith(1);
    expect(valider).toBeEnabled();

    fireEvent.click(valider);
    expect(p.onValider).toHaveBeenCalledWith(1);
  });

  it("annonce la fin du test sur la dernière question", () => {
    render(<QuestionCard {...props(qcm, { choisie: 0, derniere: true })} />);
    expect(screen.getByRole("button", { name: "Valider et finaliser" })).toBeEnabled();
  });

  it("une fois la réponse corrigée, verrouille les choix et signale la bonne et la mauvaise réponse", () => {
    render(<QuestionCard {...props(qcm, { choisie: 1, retour: { choisie: 1, bonneReponse: 0 } })} />);

    screen.getAllByRole("radio").forEach((option) => expect(option).toBeDisabled());
    expect(screen.getByTestId("option-0")).toHaveClass("border-success");
    expect(screen.getByTestId("option-1")).toHaveClass("border-error");
    expect(screen.queryByRole("button", { name: /Valider/ })).not.toBeInTheDocument();
  });

  it("pendant l'envoi, bloque la question et indique que la réponse est enregistrée", () => {
    render(<QuestionCard {...props(qcm, { choisie: 0, envoiEnCours: true })} />);

    screen.getAllByRole("radio").forEach((option) => expect(option).toBeDisabled());
    expect(screen.queryByRole("button", { name: /Valider/ })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Enregistrement de votre réponse");
  });

  it("propose l'écoute de l'extrait en compréhension orale", () => {
    render(<QuestionCard {...props(ecoute)} />);

    expect(screen.getByText("Écoutez l'extrait, puis choisissez ce que vous avez entendu.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Where is the speaker going?" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("n'accepte une rédaction qu'à partir du nombre de mots demandé", () => {
    const p = props(redaction, { derniere: true });
    render(<QuestionInteractive {...p} />);

    expect(screen.getByRole("heading", { name: /Présentez-vous en quelques phrases/ })).toHaveTextContent("Sujet :");
    const valider = screen.getByRole("button", { name: "Valider et finaliser" });

    fireEvent.change(screen.getByLabelText("Votre réponse"), { target: { value: "Je suis Rova." } });
    expect(valider).toBeDisabled();

    const texte = "Je suis Rova et j'apprends l'anglais.";
    fireEvent.change(screen.getByLabelText("Votre réponse"), { target: { value: texte } });
    expect(valider).toBeEnabled();
    fireEvent.click(valider);
    expect(p.onValiderTexte).toHaveBeenCalledWith(texte);
  });

  it("pendant l'analyse d'une réponse libre, explique qu'elle reste affichée", () => {
    render(<QuestionCard {...props(redaction, { reponseLibre: "Je suis Rova et j'apprends l'anglais.", envoiEnCours: true })} />);

    expect(screen.getByLabelText("Votre réponse")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Elle reste affichée jusqu'à la confirmation");
  });

  it("affiche les jetons mélangés du texte à trous et accepte la réponse reconstruite", () => {
    const p = props(trous);
    render(<QuestionInteractive {...p} />);

    expect(screen.getByText("Complétez le mot manquant avec les lettres proposées.")).toBeInTheDocument();
    expect(screen.getByTestId("texte-a-trous")).toBeInTheDocument();
    expect(screen.getAllByText("N")).toHaveLength(2);
    const valider = screen.getByRole("button", { name: "Valider et continuer" });
    expect(valider).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Votre réponse"), { target: { value: "London" } });
    expect(valider).toBeEnabled();
    fireEvent.click(valider);
    expect(p.onValiderTexte).toHaveBeenCalledWith("London");
  });

  it("affiche la consigne de dictée sans révéler la phrase à écrire", () => {
    render(<QuestionCard {...props(dictee)} />);

    expect(screen.getByText("Écoutez la phrase, puis écrivez exactement ce que vous avez entendu.")).toBeInTheDocument();
    expect(screen.queryByText("I live in London.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Votre réponse")).toBeInTheDocument();
  });

  it("affiche la phrase à répéter pour l'exercice parler", () => {
    render(<QuestionCard {...props(parler)} />);

    expect(screen.getByText("Répétez la phrase suivante.")).toBeInTheDocument();
    expect(screen.getByTestId("consigne-parler")).toHaveTextContent("2 s");
    expect(screen.getByText("« I live in London. »")).toBeInTheDocument();
    expect(screen.getByTestId("enregistrement-oral")).toBeInTheDocument();
  });
});
