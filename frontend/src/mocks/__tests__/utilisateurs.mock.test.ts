import { COMPTES_DEMO } from "@/mocks/comptes-demo";
import { utilisateursMock } from "@/mocks/utilisateurs.mock";

const FILTRES = { recherche: "", role: null, page: 1, taille: 10 };

describe("utilisateursMock.modifier", () => {
  it("modifie l'utilisateur, et la liste le reflète", async () => {
    const { idUser } = COMPTES_DEMO.APPRENANT.utilisateur;

    await utilisateursMock.modifier(idUser, { statut: "INACTIF", role: "FORMATEUR" });

    const { items } = await utilisateursMock.lister({ ...FILTRES, recherche: "apprenant@digitheque.mg" });
    expect(items[0]).toMatchObject({ idUser, statut: "INACTIF", role: "FORMATEUR" });
  });

  it("refuse l'e-mail d'un autre compte (409) et un identifiant inconnu (404)", async () => {
    await expect(
      utilisateursMock.modifier(COMPTES_DEMO.FORMATEUR.utilisateur.idUser, { email: COMPTES_DEMO.ADMINISTRATEUR.utilisateur.email }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(utilisateursMock.modifier(99999, { statut: "ACTIF" })).rejects.toMatchObject({ status: 404 });
  });
});
