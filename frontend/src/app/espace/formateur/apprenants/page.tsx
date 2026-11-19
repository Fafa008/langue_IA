import type { Metadata } from "next";
import ApprenantsView from "@/components/formateur/apprenants/ApprenantsView";

export const metadata: Metadata = { title: "Mes apprenants – Digithèque" };

export default function ApprenantsPage() {
  return <ApprenantsView />;
}
