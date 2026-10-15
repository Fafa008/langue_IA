import type { Metadata } from "next";
import ProfilView from "@/components/profil/ProfilView";

export const metadata: Metadata = { title: "Mon profil – Digithèque" };

export default function ProfilPage() {
  return <ProfilView />;
}
