import type { Plan } from "@/core/plan";

/**
 * What each paid plan costs and includes, as the public pricing page and the
 * dashboard's plans page both show it. One list, so the two never disagree.
 */
export interface PlanOffer {
  plan: Plan;
  name: string;
  amt: string;
  badge?: string;
  featured?: boolean;
  pitch: string;
  features: string[];
}

export const PLAN_OFFERS: PlanOffer[] = [
  {
    plan: "pulse",
    name: "Pulse",
    amt: "$149",
    pitch: "For brands that want to see how often AI recommends them, and what it says.",
    features: [
      "Weekly scans across every major AI assistant",
      "Dashboard with every answer, word for word",
      "Weekly email of what changed",
      "Wrong-fact alerts",
      "The sources AI cites about you",
      "How often AI recommends you versus three competitors",
      "Monthly report and prioritized action plan",
      "One-time cleanup available for a fee",
    ],
  },
  {
    plan: "partner",
    name: "Partner",
    amt: "$399",
    badge: "Most popular",
    featured: true,
    pitch: "A full partnership. We do the work to put your brand first.",
    features: [
      "Everything in Pulse",
      "We clear false information for you",
      "We do the work to get you recommended",
      "More questions and competitors tracked",
      "Call us whenever, plus a monthly strategy call",
    ],
  },
];
