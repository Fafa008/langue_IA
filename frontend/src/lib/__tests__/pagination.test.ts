import { formatDateCourte } from "@/lib/date";
import { ELLIPSE, nombreDePages, pagesAffichees } from "@/lib/pagination";

describe("nombreDePages", () => {
  it("arrondit au supérieur et renvoie au moins 1", () => {
    expect(nombreDePages(47, 10)).toBe(5);
    expect(nombreDePages(50, 10)).toBe(5);
    expect(nombreDePages(0, 10)).toBe(1);
  });
});

describe("pagesAffichees", () => {
  it("affiche toutes les pages quand il y en a peu", () => {
    expect(pagesAffichees(1, 1)).toEqual([1]);
    expect(pagesAffichees(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("garde une fenêtre de taille constante près des bords", () => {
    expect(pagesAffichees(1, 10)).toEqual([1, 2, 3, 4, 5, ELLIPSE, 10]);
    expect(pagesAffichees(4, 10)).toEqual([1, 2, 3, 4, 5, ELLIPSE, 10]);
    expect(pagesAffichees(10, 10)).toEqual([1, ELLIPSE, 6, 7, 8, 9, 10]);
    expect(pagesAffichees(7, 10)).toEqual([1, ELLIPSE, 6, 7, 8, 9, 10]);
  });

  it("entoure la page courante au milieu", () => {
    expect(pagesAffichees(5, 10)).toEqual([1, ELLIPSE, 4, 5, 6, ELLIPSE, 10]);
    expect(pagesAffichees(6, 10)).toEqual([1, ELLIPSE, 5, 6, 7, ELLIPSE, 10]);
  });

  it("affiche toujours 7 éléments au-delà de 7 pages", () => {
    for (let page = 1; page <= 20; page++) expect(pagesAffichees(page, 20)).toHaveLength(7);
  });
});

describe("formatDateCourte", () => {
  it("formate en JJ/MM/AAAA", () => {
    expect(formatDateCourte("2025-01-12T12:00:00Z")).toBe("12/01/2025");
    expect(formatDateCourte("pas une date")).toBe("—");
  });
});
