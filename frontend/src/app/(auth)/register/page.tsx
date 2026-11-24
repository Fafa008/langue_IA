import type { Metadata } from "next";
import RegisterForm from "@/components/auth/RegisterForm";
import { LANGUES } from "@/lib/languages";
import type { CodeLangue } from "@/types/langue";

export const metadata: Metadata = { title: "Inscription – Digithèque" };

const CODES_LANGUES: ReadonlySet<string> = new Set(LANGUES.map(({ code }) => code));

function estCodeLangue(code: string | undefined): code is CodeLangue {
  return code !== undefined && CODES_LANGUES.has(code);
}

export default function RegisterPage({ searchParams }: { searchParams?: { lang?: string | string[] } }) {
  const langue = typeof searchParams?.lang === "string" ? searchParams.lang : undefined;
  return <RegisterForm langueInitiale={estCodeLangue(langue) ? langue : undefined} />;
}
