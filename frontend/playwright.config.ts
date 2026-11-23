import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Un seul serveur Next pour 440 tests : trop de workers saturent le CPU sous Windows et
  // provoquent des timeouts de navigation sur des specs pourtant inchangées.
  workers: 2,
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    navigationTimeout: 60_000,
    // Sous Windows, l'écriture concurrente des traces avec 2 workers peut laisser des fichiers
    // orphelins (ENOENT à la fermeture du context). La CI garde les traces en cas d'échec.
    trace: process.env.CI ? "retain-on-failure" : "off",
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  // Chaque test tourne sur desktop et sur mobile (critère « Responsive »)
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    // Un build de production évite la compilation à la demande de `next dev` : les navigations
    // des 440 tests deviennent rapides et reproductibles (le build sert aussi `next start`).
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 900_000,
    // Les tests interceptent eux-mêmes les appels HTTP : pas de données simulées côté app.
    // NEXT_PUBLIC_PARCOURS_MOCK est forcé aussi : un frontend/.env.local local peut le mettre à true.
    env: { NEXT_PUBLIC_API_MOCK: "false", NEXT_PUBLIC_PARCOURS_MOCK: "false", NEXT_DIST_DIR: ".next-e2e" },
  },
});
