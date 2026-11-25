import { render, screen } from "@testing-library/react";
import Languages from "@/components/Language";

describe("Languages", () => {
  it("dirige chaque langue vers la page d'inscription", () => {
    render(<Languages />);

    const langues = [
      { name: "Français", code: "fr" },
      { name: "Anglais", code: "en" },
      { name: "Mandarin", code: "zh" },
      { name: "Italien", code: "it" },
      { name: "Allemand", code: "de" },
    ];
    expect(screen.getAllByRole("link")).toHaveLength(langues.length);

    langues.forEach(({ name, code }) => {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `/register?lang=${code}`);
    });
  });
});
