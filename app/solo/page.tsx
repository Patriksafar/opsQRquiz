import type { Metadata } from "next";
import { loadQuestions, stripAnswers } from "@/lib/solo";
import SoloQuiz from "./solo-quiz";

// Read questions.json per request, matching how server.ts loads it, so editing
// the file and restarting is enough — no rebuild.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kvíz · US Launchpad",
  description: "Vyplň kvíz a získej odměnu.",
};

export default function SoloPage() {
  // stripAnswers keeps correctIndex on the server — see lib/solo.ts.
  const questions = stripAnswers(loadQuestions());
  return <SoloQuiz questions={questions} />;
}
