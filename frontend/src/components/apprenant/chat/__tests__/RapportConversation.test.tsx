import { render, screen } from "@testing-library/react";
import RapportConversation from "@/components/apprenant/chat/RapportConversation";

// Le rapport de fin suit la langue du parcours, comme le reste de la page du tuteur.
const MESSAGES = [
  { role: "assistant" as const, contenu: "Hello! What is your name?" },
  { role: "apprenant" as const, contenu: "My name is Rija." },
];

describe("RapportConversation — langue du parcours", () => {
  it("parcours en anglais : la synthèse est rédigée en anglais", () => {
    render(
      <RapportConversation
        messages={MESSAGES}
        scenario="Introducing yourself"
        langue="English"
        codeLangue="en"
        onRecommencer={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Your summary" })).toBeInTheDocument();
    expect(screen.getByText("Last exchange")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start a new conversation/ })).toBeInTheDocument();
    expect(screen.queryByText(/Votre synthèse|Dernier échange|Recommencer/)).not.toBeInTheDocument();
  });

  it("langue non traduite : repli sur les libellés français", () => {
    render(
      <RapportConversation messages={MESSAGES} scenario="Se présenter" langue="Malagasy" codeLangue="mg" onRecommencer={() => {}} />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Votre synthèse" })).toBeInTheDocument();
  });
});
