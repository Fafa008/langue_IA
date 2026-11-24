import { fireEvent, render, screen } from "@testing-library/react";
import LanguePicker from "@/components/auth/LanguePicker";

describe("LanguePicker", () => {
  it("affiche les choix dans une liste déroulante et conserve la sélection multiple", () => {
    const onChange = jest.fn();
    render(<LanguePicker value={["zh"]} onChange={onChange} />);

    const bouton = screen.getByRole("button", { name: "Choisir les langues souhaitées" });
    expect(bouton).toHaveAccessibleDescription(/Sélection actuelle : Mandarin/);
    fireEvent.click(bouton);

    expect(screen.getByRole("checkbox", { name: "Mandarin" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Français" }));
    expect(onChange).toHaveBeenCalledWith(["zh", "fr"]);
  });

  it("ferme la liste avec Échap et rend le focus au bouton", () => {
    render(<LanguePicker value={[]} onChange={jest.fn()} />);

    const bouton = screen.getByRole("button", { name: "Choisir les langues souhaitées" });
    fireEvent.click(bouton);
    const checkbox = screen.getByRole("checkbox", { name: "Français" });
    checkbox.focus();
    fireEvent.keyDown(checkbox, { key: "Escape" });

    expect(screen.queryByRole("checkbox", { name: "Français" })).not.toBeInTheDocument();
    expect(bouton).toHaveFocus();
  });
});
