import { act, fireEvent, render, screen } from "@testing-library/react";
import { useConfirmationSortie } from "@/hooks/useConfirmationSortie";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function Page({ actif, onNavigation = jest.fn() }: { actif: boolean; onNavigation?: () => void }) {
  const sortie = useConfirmationSortie(actif);
  return (
    <>
      <a href="/espace/apprenant" onClick={(event) => { if (!event.defaultPrevented) onNavigation(); }}>Accueil</a>
      <a href="https://www.coe.int">Site externe</a>
      <a href="/aide" target="_blank">Aide</a>
      {sortie.destination && (
        <div role="dialog">
          <span>{sortie.destination}</span>
          <button type="button" onClick={sortie.annuler}>Rester</button>
          <button type="button" onClick={sortie.confirmer}>Quitter</button>
        </div>
      )}
    </>
  );
}

/** Événement beforeunload : `defaultPrevented` vrai quand l'avertissement du navigateur est demandé. */
function fermerOnglet() {
  const event = new Event("beforeunload", { cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

beforeEach(() => jest.clearAllMocks());

describe("useConfirmationSortie", () => {
  it("pendant le test, suspend la navigation interne jusqu'à la confirmation", () => {
    const onNavigation = jest.fn();
    render(<Page actif onNavigation={onNavigation} />);

    fireEvent.click(screen.getByRole("link", { name: "Accueil" }));
    expect(onNavigation).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("/espace/apprenant");

    fireEvent.click(screen.getByRole("button", { name: "Quitter" }));
    expect(push).toHaveBeenCalledWith("/espace/apprenant");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("l'apprenant peut rester sur la page", () => {
    render(<Page actif />);

    fireEvent.click(screen.getByRole("link", { name: "Accueil" }));
    fireEvent.click(screen.getByRole("button", { name: "Rester" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("laisse le navigateur avertir pour la fermeture, le rechargement et les liens externes", () => {
    render(<Page actif />);

    expect(fermerOnglet()).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "Site externe" }));
    fireEvent.click(screen.getByRole("link", { name: "Aide" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hors test, ne retient aucune navigation", () => {
    const onNavigation = jest.fn();
    const { rerender } = render(<Page actif onNavigation={onNavigation} />);
    rerender(<Page actif={false} onNavigation={onNavigation} />);

    expect(fermerOnglet()).toBe(false);
    fireEvent.click(screen.getByRole("link", { name: "Accueil" }));
    expect(onNavigation).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
