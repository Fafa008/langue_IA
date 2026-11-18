import { notFound } from "next/navigation";
import ModuleVue from "@/components/pedagogie/parcours/ModuleVue";
import { numeroDepuisUrl } from "@/lib/parcours-personnalise";

export default function ModulePage({ params }: { params: { numero: string } }) {
  const numero = numeroDepuisUrl(params.numero);
  if (numero === null) notFound();
  return <ModuleVue numero={numero} />;
}
