import { auth, requirePracticeAccess } from "@/lib/auth";
import { ADMIN_READ_ONLY_MESSAGE, isAdminViewer } from "@/lib/admin-view";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, Note, PageBody } from "@/components/ui";
import { SUPPORT_TOPICS } from "@/services/support";
import { submitHelp } from "./actions";
import { HelpForm } from "./help-form";

// Written for the questions customers actually ask. "Why did my score change"
// comes first because AI answers move week to week and a normal dip looks
// like a failure if nobody explains it.
const FAQ: { q: string; a: string }[] = [
  {
    q: "Why did my score change?",
    a: "AI tools give slightly different answers to the same question from one day to the next. We ask every question several times, so a small move is normal. A big move, or a drop two weeks in a row, is real, and we will already be looking at it.",
  },
  {
    q: "What do the three scores mean?",
    a: "Recommended by AI is how often and how high AI names you when customers ask without using your name. Accuracy is how much of what AI says about you is true, checked against the Fact Sheet you confirmed. It starts at 100 and loses points for each wrong fact, and wrong prices cost extra. Overall combines the two. Each score runs from 30 to 100: every business starts at 30.",
  },
  {
    q: "AI said something wrong about us. What now?",
    a: "It shows up under Wrong facts on the What AI says tab, next to the truth and the pages the AI tool read before saying it. Fixing it usually means correcting that page or your own listings. If it is something we have not caught, tell us below.",
  },
  {
    q: "How long do fixes take to show up?",
    a: "When AI looks things up live, a corrected page can change its answers within days to a few weeks. What an AI tool learned earlier changes more slowly, usually when a new version of it comes out.",
  },
  {
    q: "Where does AI get its information?",
    a: "The Competitors tab lists every website the AI tools read in your latest scan, and which ones they read when they recommended a competitor and not you. Those are the sites worth getting onto.",
  },
];

/** Help: the questions customers ask most, then a form that reaches us by email. */
export default async function HelpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const practice = await requirePracticeAccess(slug);
  const session = await auth();
  const readOnlyNote = isAdminViewer(session?.user?.role) ? ADMIN_READ_ONLY_MESSAGE : undefined;

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="help" />

      <div className="space-y-4">
        <Card title="Common questions">
          <div className="divide-y divide-line">
            {FAQ.map(item => (
              <details key={item.q} className="py-3">
                <summary className="cursor-pointer text-[15px] font-semibold text-ink marker:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                  <span className="ml-1">{item.q}</span>
                </summary>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </Card>

        <Card title="Send us a message">
          <Note className="mb-4">We reply by email within one business day.</Note>
          <HelpForm action={submitHelp.bind(null, slug)} topics={SUPPORT_TOPICS} readOnlyNote={readOnlyNote} />
        </Card>
      </div>
    </PageBody>
  );
}
