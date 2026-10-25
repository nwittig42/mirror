import { describe, it, expect, vi } from "vitest";
import sample from "@/report/sample-audit.json";
import type { AuditReport } from "@/report/types";
import { composeProspectReportEmail, summaryParagraph } from "@/services/prospect-audit-email";

const r = { ...(sample as unknown as AuditReport), prospect: true };
const named = r.leaderboard.find(e => e.isClient)!.count;
const answers = r.scan.buyerQuestionCount * r.scan.runsPerQuestion * r.scan.tools.length;
const unescape = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

describe("summaryParagraph", () => {
  it("says, in plain words, how often they came up against their top competitor", () => {
    const p = summaryParagraph(r);
    expect(p).toContain(`${named} of ${answers}`);
    expect(p).toContain(r.topCompetitor.name);
    expect(p).not.toMatch(/visibility|citation|prompt|score/i);
  });
});

describe("composeProspectReportEmail", () => {
  const { subject, html } = composeProspectReportEmail(r, { contactName: "Dr. Kim Lee", appName: "Mirror" });
  const body = unescape(html);

  it("leads with the competitor they're losing to", () => {
    expect(subject).toBe(`When people ask AI for a ${r.business.category.toLowerCase()} in ${r.business.location.split(",")[0]}, they're sent to ${r.topCompetitor.name}`);
  });
  it("greets them by first name, summarises, quotes AI, and points to the attached report", () => {
    expect(body).toContain("Hi Dr. Kim,");
    expect(body).toContain(summaryParagraph(r));
    expect(body).toContain(r.missedQuote!.text);
    expect(body).toMatch(/attached/i);
  });
  it("asks them to book a call to set up their fact sheet, and never states a wrong fact", () => {
    expect(body).toMatch(/fact sheet/i);
    expect(body).toContain(r.contact.bookingUrl);
    for (const f of r.facts.filter(f => !f.isTrue)) expect(body).not.toContain(f.aiSaid!);
  });
});

describe("sendProspectReport", () => {
  it("attaches the summary PDF, and still sends without it if the PDF fails", async () => {
    const { sendProspectReport } = await import("@/services/prospect-audit-email");
    for (const env of ["DATABASE_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "PERPLEXITY_API_KEY", "RESEND_API_KEY", "CRON_SECRET", "AUTH_SECRET"]) process.env[env] ||= "k";
    process.env.APP_URL ||= "http://localhost:3000";
    const transport = vi.fn().mockResolvedValue(undefined);
    const load = async () => r;
    await sendProspectReport({ report: load, to: "dale@harbor-plumbing.example", contactName: "Dale", transport, pdf: async () => Buffer.from("%PDF-1") });
    expect(transport.mock.calls[0][0]).toMatchObject({ to: "dale@harbor-plumbing.example", attachments: [{ filename: expect.stringMatching(/\.pdf$/) }] });
    await sendProspectReport({ report: load, to: "dale@harbor-plumbing.example", contactName: "Dale", transport, pdf: async () => { throw new Error("no chrome"); } });
    expect(transport.mock.calls[1][0]).toMatchObject({ attachments: [] });
  });
});

describe("the prospect's login", () => {
  const login = { email: "dale@harbor-plumbing.example", setupUrl: "https://mirror.example/welcome?token=abc123", loginUrl: "https://mirror.example/login" };

  it("gives a set-up link and no temporary password", () => {
    const body = unescape(composeProspectReportEmail(r, { contactName: "Dale", appName: "Mirror", login }).html);
    expect(body).toContain("Your account");
    expect(body).toContain("Choose a password to see your full audit.");
    expect(body).toContain("Set up your account");
    expect(body).toContain('href="https://mirror.example/welcome?token=abc123"');
    expect(body).not.toContain("Temporary password");
  });

  it("tells someone who already has a password to log in with their email", () => {
    const body = unescape(composeProspectReportEmail(r, { contactName: "Dale", appName: "Mirror", login: { ...login, setupUrl: null } }).html);
    expect(body).toContain("Log in with dale@harbor-plumbing.example to see your full audit.");
    expect(body).toContain('href="https://mirror.example/login"');
    expect(body).not.toContain("welcome?token");
    expect(body).not.toContain("Set up your account");
  });

  it("says nothing about an account when no login was made", () => {
    expect(composeProspectReportEmail(r, { contactName: "Dale", appName: "Mirror" }).html).not.toContain("Your account");
  });
});
