import type { Metadata } from "next";
import { LandingHome } from "@/components/landing/home";

/**
 * Public marketing home page. Unauthenticated alongside /how-it-works,
 * /pricing, /login and /book (the audit-request form every CTA points at).
 * The signed-in role router that used to live here now sits at /app.
 *
 * The page itself is src/components/landing/home.tsx.
 */

export const metadata: Metadata = {
  title: "Mirror: Get recommended by AI",
  description:
    "Mirror tracks how often ChatGPT, Gemini, Perplexity and other AI assistants recommend your brand, flags every wrong fact, and shows you how to improve both.",
};

export default function LandingPage() {
  return <LandingHome />;
}
