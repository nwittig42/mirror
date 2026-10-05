import { auth, requirePracticeAccess } from "@/lib/auth";
import { ADMIN_READ_ONLY_MESSAGE, isAdminViewer } from "@/lib/admin-view";
import { DashboardHeader } from "@/components/dashboard-header";
import { SUPPORT_TOPICS } from "@/services/support";
import { submitHelp } from "./actions";
import { HelpForm } from "./help-form";

// Written for the questions clients actually ask. "Why did my score change"
// comes first because AI answers move week to week and a normal dip looks
// like a failure if nobody explains it.
const FAQ: { q: string; a: string }[] = [
  {
    q: "Why did my score change?",
    a: "AI engines give slightly different answers to the same question from one day to the next. We ask every question several times and show the range, so a move inside that range is normal noise. A move outside it, or a drop two weeks running, is real, and we'll already be looking at it.",
  },
  {
    q: "What do the three numbers mean?",
    a: "Visibility is how often and how high AI recommends you when customers ask without using your name. Fact accuracy is how correct AI is about you, checked against the fact sheet you confirmed: it starts at 100 and loses points for each wrong fact, with wrong prices counting extra. The overall score combines both.",
  },
  {
    q: "AI said something wrong about us. What now?",
    a: "It will show up on your Accuracy tab with the pages the AI read before saying it. Fixing it usually means correcting that page or your own listings. If it's something we haven't caught, tell us below.",
  },
  {
    q: "How long do fixes take to show up?",
    a: "When AI looks things up live, a corrected page can change answers within days to a few weeks. What a model learned in training changes more slowly, usually when a new model version ships.",
  },
  {
    q: "Where does AI get its information?",
    a: "The Sources tab shows every site the engines cited this week, and which ones they cited when they recommended a competitor instead of you. Those are the sites worth getting onto.",
  },
];

export default async function HelpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const practice = await requirePracticeAccess(slug);
  const session = await auth();
  const readOnlyNote = isAdminViewer(session?.user?.role) ? ADMIN_READ_ONLY_MESSAGE : undefined;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <DashboardHeader slug={slug} practiceName={practice.name} active="help" />

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-medium text-black dark:text-zinc-50">Common questions</h2>
        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {FAQ.map(item => (
            <details key={item.q} className="group px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-black dark:text-zinc-50">{item.q}</summary>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">Need help?</h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Send us a message and we&apos;ll reply by email within one business day.
        </p>
        <HelpForm action={submitHelp.bind(null, slug)} topics={SUPPORT_TOPICS} readOnlyNote={readOnlyNote} />
      </section>
    </div>
  );
}
