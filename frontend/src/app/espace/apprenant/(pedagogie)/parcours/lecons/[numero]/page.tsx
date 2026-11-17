import { notFound } from "next/navigation";
import LeconVue from "@/components/pedagogie/parcours/LeconVue";
import { numeroDepuisUrl } from "@/lib/parcours-personnalise";

export default function LeconPage({ params }: { params: { numero: string } }) {
  const numero = numeroDepuisUrl(params.numero);
  if (numero === null) notFound();
  return <LeconVue numero={numero} />;
}
