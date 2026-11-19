import type { Metadata } from "next";
import ChatView from "@/components/apprenant/chat/ChatView";

export const metadata: Metadata = { title: "Professeur IA – Digithèque" };

export default function ChatPage() {
  return <ChatView />;
}
