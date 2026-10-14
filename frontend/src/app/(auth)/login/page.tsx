import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Connexion – Digithèque" };

export default function LoginPage({ searchParams }: { searchParams: { reset?: string } }) {
  return <LoginForm passwordReset={searchParams.reset === "success"} />;
}
