import { expect, test, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, handlePreflight, json, loginAs, type UtilisateurDto } from "./support/session";
import { CONTENU_QCM_VISIBLE, CORRECTION_JUSTE, exerciceDto, parcoursDto, servirParcours } from "./support/parcours";
import { mockTestDiagnosticApi } from "./support/test-diagnostic-api";

/*
 * Scénario de démonstration générale du mémoire (A–N). Les 15 étapes sont numérotées dans les noms de tests ;
 * les cas limites demandés (API indisponible, session expirée, réponse invalide, sans recommandation,
 * micro refusé, IA indisponible) sont regroupés à la fin. Comme tous les tests E2E, l'API est interceptée :
 * aucun mock n'est activé dans l'application et les réponses respectent le contrat backend.
 */

const APPRENANT: UtilisateurDto = {
  id_user: 1,
  nom: "RAKOTO",
  prenom: "Rova",
  email: "apprenant@digitheque.mg",
  telephone: null,
  role: "APPRENANT",
  statut: "ACTIF",
  date_inscription: "2025-01-12T10:00:00Z",
};

const FORMATEUR: UtilisateurDto = { ...APPRENANT, id_user: 2, nom: "RABE", prenom: "Hery", role: "FORMATEUR" };
const ADMIN: UtilisateurDto = { ...APPRENANT, id_user: 3, nom: "ADMIN", prenom: "Paul", role: "ADMINISTRATEUR" };

// Le serveur Next de dev compile certaines routes à la demande sous Windows : navigation et test plus patients.
test.beforeEach(({ page }) => {
  test.setTimeout(120_000);
  page.setDefaultNavigationTimeout(60_000);
  page.setDefaultTimeout(15_000);
});

const aller = (page: Page, url: string) => page.goto(url);

/** Parcours de démonstration avec un QCM corrigé localement. */
async function installerParcours(page: Page, utilisateur: UtilisateurDto = APPRENANT) {
  const ligne = exerciceDto(231, 23, "Le passé composé", "A_FAIRE", null);
  await loginAs(page, utilisateur);
  await servirParcours(page, {
    parcours: parcoursDto(23, "PASSIVE"),
    exercices: [ligne],
    lecons: { 23: { exercices: [{ ...ligne, contenu: CONTENU_QCM_VISIBLE }] } },
    corrections: { 231: CORRECTION_JUSTE },
  });
}

/** Chat branché sur le relais backend, avec fermeture de session. */
async function installerChat(page: Page, statutMessage = 200) {
  const requetes: { identifiant_session: string }[] = [];
  const sessionsFermees: string[] = [];
  // Depuis US73, la langue du chat vient du parcours : sans ce mock, la page affiche l'alerte « sans parcours ».
  await page.route("**/api/v1/parcours/en-cours", async (route: Route) => {
    if (await handlePreflight(route)) return;
    await json(route, 200, parcoursDto(23, "PASSIVE"));
  });
  await page.route("**/api/v1/chatbot/message", async (route: Route) => {
    if (await handlePreflight(route)) return;
    requetes.push(route.request().postDataJSON() as { identifiant_session: string });
    if (statutMessage !== 200) return json(route, statutMessage, { detail: "Détail technique interne" });
    await json(route, 200, { reponse: "Très bien ! Et après ?", corrections: [], quota_restant: 19 });
  });
  await page.route("**/api/v1/chatbot/session/*", async (route: Route) => {
    if (await handlePreflight(route)) return;
    sessionsFermees.push(route.request().url().split("/session/")[1] ?? "");
    await json(route, 200, { supprime: true });
  });
  return { requetes, sessionsFermees };
}

/** Termine le test adaptatif jusqu'à l'écran de résultats (deux questions en anglais). */
async function terminerDiagnostic(page: Page) {
  // La langue est présélectionnée par `?langue=en` ; attendre le chargement des langues évite un clic prématuré.
  const commencer = page.getByRole("button", { name: "Commencer le test", exact: true });
  await expect(commencer).toBeEnabled();
  await commencer.click();
  await page.getByRole("button", { name: /Lancer le test/ }).click();
  await expect(page).toHaveURL("/espace/apprenant/test-diagnostic/test", { timeout: 30_000 });

  for (let i = 0; i < 2; i += 1) {
    await expect(page.getByTestId("question-card")).toBeVisible();
    await page.getByTestId("option-0").click();
    await page.getByRole("button", { name: /Valider et/ }).click();
    if (i === 0) await page.getByRole("button", { name: "Question suivante" }).click();
  }
  await page.getByRole("button", { name: "Finaliser le test" }).click();
  await expect(page).toHaveURL("/espace/apprenant/test-diagnostic/resultats", { timeout: 30_000 });
}

test.describe("Démonstration générale — scénarios 1 à 15", () => {
  test("1. Connexion avec le compte apprenant de démonstration", async ({ page }) => {
    // Le formulaire de connexion est couvert par login.spec ; ici on ouvre la session démo et on vérifie l'entrée.
    await loginAs(page, APPRENANT);
    await aller(page, "/espace/apprenant");
    await expect(page.getByRole("heading", { level: 1, name: /Bonjour Rova/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mon parcours/ }).first()).toBeVisible();
  });

  test("2. Tableau de bord apprenant : raccourcis actifs et rubriques non livrées signalées", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await aller(page, "/espace/apprenant");
    await expect(page.getByTestId("etat-modules")).toContainText("ne sont pas livrées");
    await expect(page.getByRole("link", { name: /Mon parcours/ }).first()).toHaveAttribute(
      "href",
      "/espace/apprenant/parcours",
    );
    await expect(page.locator("main li").filter({ hasText: "Ateliers" })).toContainText("Bientôt");
  });

  test("3. Test de positionnement : démarrage, questions et résultat calculé", async ({ page }) => {
    await mockTestDiagnosticApi(page, { avecAnalyse: true });
    await loginAs(page, APPRENANT);
    await aller(page, "/espace/apprenant/test-diagnostic?langue=en");
    await terminerDiagnostic(page);
    await expect(page.getByTestId("result-level")).toBeVisible();
    await expect(page.getByRole("link", { name: "Commencer mon parcours" })).toBeVisible();
  });

  test("4. Résultat du diagnostic : l'analyse partielle reste lisible", async ({ page }) => {
    await mockTestDiagnosticApi(page);
    await loginAs(page, APPRENANT);
    await aller(page, "/espace/apprenant/test-diagnostic?langue=en");
    await terminerDiagnostic(page);
    await expect(page.getByTestId("test-result")).toBeVisible();
    await expect(page.getByTestId("erreur-diagnostic")).toHaveCount(0);
  });

  test("5. Parcours personnalisé : langue, niveau, leçon et modules", async ({ page }) => {
    await installerParcours(page);
    await aller(page, "/espace/apprenant/parcours");
    await expect(page.getByText("Votre parcours de Français vers le niveau B1.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mes modules" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Niveaux du CECRL" })).toContainText("B1");
  });

  test("6. Exercice du parcours : une réponse, une correction, feedback immédiat", async ({ page }) => {
    await installerParcours(page);
    await aller(page, "/espace/apprenant/parcours/lecons/23");
    const exercice = page.getByRole("region", { name: "Le passé composé" });
    await exercice.getByRole("radio", { name: "suis allé" }).check();
    await exercice.getByRole("button", { name: "Valider ma réponse" }).click();
    await expect(exercice.getByText("Réussi · 100/100")).toBeVisible();
    await expect(exercice.getByRole("button", { name: "Valider ma réponse" })).toHaveCount(0);
  });

  test("7. Recommandations : action ciblée et lien vers la leçon", async ({ page }) => {
    await installerParcours(page);
    await page.route("**/api/v1/parcours/7/recommandations", async (route: Route) => {
      await json(route, 200, {
        statut: "COMPLET",
        code_langue: "fr",
        referentiel: "CECRL",
        niveau_cible: "B1",
        recommandations: [
          {
            domaine: "grammaire",
            type_exercice: "GRAMMAIRE",
            action: "Refaire un exercice sur le passé composé.",
            justification: "Les formes au passé restent hésitantes.",
            priorite: 1,
          },
        ],
        resume: "Une action courte : conjugaison au passé.",
        confiance: 0.72,
      });
    });
    await aller(page, "/espace/apprenant/parcours");
    await page.getByRole("button", { name: "Afficher mes recommandations" }).click();
    const section = page.getByRole("region", { name: "Mes recommandations" });
    await expect(section).toContainText("Français · Niveau cible B1 (CECRL)");
    await expect(section.getByRole("list", { name: "Actions recommandées" })).toContainText(
      "Refaire un exercice sur le passé composé.",
    );
    await expect(section.getByRole("link", { name: /Aller à la leçon 23/ })).toHaveAttribute(
      "href",
      "/espace/apprenant/parcours/lecons/23",
    );
  });

  test("8. Professeur IA : échange, quota, fermeture de session et synthèse", async ({ page }) => {
    await loginAs(page, APPRENANT);
    const chat = await installerChat(page);
    await aller(page, "/espace/apprenant/chat");
    await page.getByPlaceholder("Écrivez ou dictez votre réponse…").fill("bonjour");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByTestId("quota-chat")).toContainText("19");
    await page.getByRole("button", { name: "Terminer et voir le rapport" }).click();
    await expect(page.getByTestId("rapport-chat")).toContainText("Synthèse indicative");
    expect(chat.sessionsFermees).toEqual([chat.requetes[0].identifiant_session]);
  });

  test("9. Progression : résultat réel du test distinct des indicateurs simulés", async ({ page }) => {
    await mockTestDiagnosticApi(page, { avecAnalyse: true });
    await loginAs(page, APPRENANT);
    await aller(page, "/espace/apprenant/test-diagnostic?langue=en");
    await terminerDiagnostic(page);
    const niveau = (await page.getByTestId("test-result").textContent())?.match(/\b(A1|A2|B1|B2|C1|C2)\b/)?.[1];
    expect(niveau).toBeTruthy();
    await aller(page, "/espace/apprenant/progression");
    await expect(page.getByTestId("positionnement-reel")).toContainText(`Niveau ${niveau}`);
    await expect(page.getByTestId("donnees-simulees")).toContainText("Indicateurs simulés");
    await expect(page.getByTestId("kpi-progression")).toContainText("41 %");
  });

  test("10. Profil : consultation accessible depuis l'espace apprenant", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await page.route("**/api/v1/users/me", async (route: Route) => {
      if (await handlePreflight(route)) return;
      await json(route, 200, APPRENANT);
    });
    await aller(page, "/espace/profil");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Mon profil");
  });

  test("11. Formateur : liste apprenants explicitement simulée", async ({ page }) => {
    await loginAs(page, FORMATEUR);
    await aller(page, "/espace/formateur/apprenants");
    await expect(page.getByTestId("donnees-simulees")).toHaveText("Données simulées");
    await expect(page.getByPlaceholder("Rechercher un apprenant…")).toBeVisible();
  });

  test("12. Formateur : synthèse des erreurs simulée et bilan réel annoncé", async ({ page }) => {
    await loginAs(page, FORMATEUR);
    await aller(page, "/espace/formateur/synthese-erreurs");
    await expect(page.getByTestId("synthese-simulee")).toHaveText("Synthèse simulée");
    await expect(page.getByTestId("bilan-reel")).toContainText("Bientôt");
  });

  test("13. Administrateur : tableau de bord alimenté par l'API", async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.route("**/api/v1/admin/statistiques", async (route: Route) => {
      if (await handlePreflight(route)) return;
      await json(route, 200, {
        totaux: { utilisateurs: 248, apprenants: 186, formateurs: 42, ateliers_programmes: 18 },
        apprenants_par_langue: [{ langue: { code: "fr", libelle: "Français" }, apprenants: 71 }],
        dernieres_inscriptions: [],
      });
    });
    await page.route("**/api/v1/admin/statistiques/inscriptions*", async (route: Route) => {
      if (await handlePreflight(route)) return;
      await json(route, 200, [{ date: "2026-11-20", nombre: 3 }]);
    });
    await aller(page, "/espace/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Utilisateurs 248" })).toBeVisible();
  });

  test("14. Pages légales et FAQ accessibles sans session", async ({ page }) => {
    for (const [url, titre] of [
      ["/conditions", "Conditions d'utilisation"],
      ["/confidentialite", "Politique de confidentialité"],
      ["/faq", "Questions fréquentes"],
    ]) {
      await aller(page, url);
      await expect(page.getByRole("heading", { level: 1, name: titre })).toBeVisible();
    }
  });

  test("15. Responsive : aucun débordement horizontal sur les écrans clés", async ({ page }) => {
    await installerParcours(page);
    for (const url of ["/espace/apprenant", "/espace/apprenant/parcours", "/espace/apprenant/progression"]) {
      await aller(page, url);
      const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(deborde, `débordement sur ${url}`).toBe(false);
    }
  });
});

test.describe("Démonstration générale — cas limites", () => {
  test("API indisponible : le parcours affiche une erreur sans déconnecter", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await page.route("**/api/v1/**", async (route: Route) => {
      if (await handlePreflight(route)) return;
      await route.abort();
    });
    await aller(page, "/espace/apprenant/parcours");
    const alerte = page.locator("main").getByRole("alert");
    await expect(alerte).toContainText("Le serveur est injoignable");
    await expect(alerte.getByRole("button", { name: "Réessayer" })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("Session expirée : 401 sur /users/me ramène à la connexion", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await page.route("**/api/v1/users/me", async (route: Route) => {
      if (await handlePreflight(route)) return;
      await json(route, 401, { detail: "Session expirée" });
    });
    await page.goto("/espace/apprenant");
    // `window.location.assign` pendant le chargement peut laisser l'URL vide tant que la navigation
    // n'est pas stabilisée : on attend d'abord le message de la page de connexion, puis l'URL.
    await expect(page.locator("main").getByRole("alert")).toContainText("Votre session a expiré", {
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/login\?session=expiree/, { timeout: 30_000 });
  });

  test("Réponse invalide du professeur IA : message simple et réponse conservée", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await servirParcours(page, {
      parcours: parcoursDto(23),
      exercices: [exerciceDto(231, 23, "Expression écrite", "A_FAIRE", null)],
    });
    await page.route("**/api/v1/parcours/7/lecons/23", async (route: Route) => {
      if (await handlePreflight(route)) return;
      const ligne = exerciceDto(231, 23, "Expression écrite", "A_FAIRE", null);
      await json(route, 200, {
        numero_lecon: 23,
        est_lecon_de_revision: false,
        code_langue: "fr",
        exercices: [{ ...ligne, contenu: JSON.stringify({ format: "redaction", consigne: "Écrivez.", enonce: "Écrivez.", mots_minimum: 2 }) }],
      });
    });
    await page.route("**/api/v1/parcours/7/exercices/231/reponse", async (route: Route) => {
      if (await handlePreflight(route)) return;
      await json(route, 502, { detail: "Contrat IA invalide" });
    });
    await aller(page, "/espace/apprenant/parcours/lecons/23");
    const exercice = page.getByRole("region", { name: "Expression écrite" });
    const saisie = exercice.getByRole("textbox", { name: /Écrivez/ });
    await saisie.fill("Bonjour, comment vas-tu ?");
    await exercice.getByRole("button", { name: "Envoyer au professeur IA" }).click();
    await expect(exercice.getByRole("alert")).toContainText("n'a pas abouti");
    await expect(exercice.getByRole("alert")).not.toContainText("Contrat IA invalide");
    await expect(saisie).toHaveValue("Bonjour, comment vas-tu ?");
  });

  test("Aucune recommandation disponible : message rassurant, pas d'erreur", async ({ page }) => {
    await installerParcours(page);
    await page.route("**/api/v1/parcours/7/recommandations", async (route: Route) => {
      await json(route, 200, {
        statut: "PARTIEL",
        code_langue: "fr",
        referentiel: "CECRL",
        niveau_cible: "B1",
        recommandations: [],
        resume: "Les recommandations ne sont pas disponibles pour le moment.",
        confiance: 0,
      });
    });
    await aller(page, "/espace/apprenant/parcours");
    await page.getByRole("button", { name: "Afficher mes recommandations" }).click();
    const section = page.getByRole("region", { name: "Mes recommandations" });
    await expect(section).toContainText("Aucune action ciblée cette fois");
    await expect(section.getByRole("alert")).toHaveCount(0);
  });

  test("Micro refusé : message explicite et saisie écrite toujours possible", async ({ page }) => {
    await page.addInitScript(() => {
      class RefusMicro {
        lang = "fr-FR";
        interimResults = false;
        continuous = false;
        onresult: unknown = null;
        onerror: ((e: { error: string }) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          this.onerror?.({ error: "not-allowed" });
        }
        stop() {}
        abort() {}
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = RefusMicro;
    });
    await loginAs(page, APPRENANT);
    await installerChat(page);
    await aller(page, "/espace/apprenant/chat");
    await page.getByRole("button", { name: "Dicter" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Le micro est bloqué" })).toBeVisible();
    await page.getByPlaceholder("Écrivez ou dictez votre réponse…").fill("je continue à l'écrit");
    await expect(page.getByRole("button", { name: "Envoyer" })).toBeEnabled();
  });

  test("IA indisponible sur le chat : message dédié, aucun détail technique", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await installerChat(page, 503);
    await aller(page, "/espace/apprenant/chat");
    await page.getByPlaceholder("Écrivez ou dictez votre réponse…").fill("bonjour");
    await page.getByRole("button", { name: "Envoyer" }).click();
    const alerte = page.getByRole("alert").filter({ hasText: "n'est pas disponible pour le moment" });
    await expect(alerte).toBeVisible();
    await expect(alerte).not.toContainText("Détail technique interne");
    // Le message est retiré du brouillon dès l'envoi ; l'erreur reste lisible et la saisie reprend.
    const champ = page.getByPlaceholder("Écrivez ou dictez votre réponse…");
    await expect(champ).toHaveValue("");
    await champ.fill("je réessaie");
    await expect(page.getByRole("button", { name: "Envoyer" })).toBeEnabled();
  });
});
