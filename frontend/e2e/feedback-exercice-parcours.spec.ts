import { expect, test, type Page } from "@playwright/test";
import { loginAs, type UtilisateurDto } from "./support/session";
import {
  CONTENU_QCM_VISIBLE,
  CORRECTION_FAUSSE,
  CORRECTION_JUSTE,
  exerciceDto,
  parcoursDto,
  servirParcours,
  type CorrectionDto,
} from "./support/parcours";

// US44 : feedback immédiat après un QCM, corrigé par le backend sans IA (US43-BE), sur l'API simulée.
const APPRENANT: UtilisateurDto = {
  id_user: 1,
  nom: "Rakoto",
  prenom: "Rova",
  email: "rova@exemple.com",
  telephone: null,
  role: "APPRENANT",
  statut: "ACTIF",
  date_inscription: "2025-01-12T10:00:00Z",
};

const LIGNE = 231;
const INTITULE = "Le passé composé";

async function ouvrirExercice(page: Page, correction: CorrectionDto) {
  await loginAs(page, APPRENANT);
  await servirParcours(page, {
    parcours: parcoursDto(23),
    exercices: [exerciceDto(LIGNE, 23, INTITULE, "A_FAIRE", null)],
    lecons: { 23: { exercices: [{ ...exerciceDto(LIGNE, 23, INTITULE, "A_FAIRE", null), contenu: CONTENU_QCM_VISIBLE }] } },
    corrections: { [LIGNE]: correction },
  });
  await page.goto("/espace/apprenant/parcours/lecons/23");
  return page.getByRole("region", { name: INTITULE });
}

test.describe("Feedback immédiat après un exercice du parcours (US44)", () => {
  test("bonne réponse : score 100 et réponse marquée juste", async ({ page }) => {
    const exercice = await ouvrirExercice(page, CORRECTION_JUSTE);

    await exercice.getByRole("radio", { name: "suis allé" }).check();
    await exercice.getByRole("button", { name: "Valider ma réponse" }).click();

    await expect(exercice.getByText("Réussi · 100/100")).toBeVisible();
    await expect(exercice.getByText("Bonne réponse.")).toBeVisible();
    await expect(exercice.getByText("Votre réponse, juste")).toBeVisible();
  });

  test("mauvaise réponse : bonne réponse, explication et score 0", async ({ page }) => {
    const exercice = await ouvrirExercice(page, CORRECTION_FAUSSE);

    await exercice.getByRole("radio", { name: "vais aller" }).check();
    await exercice.getByRole("button", { name: "Valider ma réponse" }).click();

    await expect(exercice.getByText("À revoir · 0/100")).toBeVisible();
    await expect(exercice.getByText("Ce n'est pas la bonne réponse.")).toBeVisible();
    await expect(exercice.getByText("Bonne réponse : suis allé")).toBeVisible();
    await expect(exercice.getByText("« Aller » se conjugue avec être au passé composé.")).toBeVisible();
    await expect(exercice.getByText("Votre réponse", { exact: true })).toBeVisible();
  });

  test("le choix ne peut pas être modifié après la correction", async ({ page }) => {
    const exercice = await ouvrirExercice(page, CORRECTION_FAUSSE);

    await expect(exercice.getByRole("button", { name: "Valider ma réponse" })).toBeDisabled();
    await exercice.getByRole("radio", { name: "vais aller" }).check();
    await exercice.getByRole("button", { name: "Valider ma réponse" }).click();
    await expect(exercice.getByText("À revoir · 0/100")).toBeVisible();

    await expect(exercice.getByRole("radio", { name: "suis allé" })).toBeDisabled();
    await expect(exercice.getByRole("radio", { name: "vais aller" })).toBeDisabled();
    await expect(exercice.getByRole("button", { name: "Valider ma réponse" })).toHaveCount(0);
  });
});
