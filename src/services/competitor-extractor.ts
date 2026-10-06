import { loadEnv } from "@/lib/env";
import { parseCompetitorOutput } from "@/core/competitors";

// Named businesses only. The extractor is what makes the competitor report
// "real": the operator's typed list is a seed, and anything an engine
// recommends that the operator did not know about has to surface here.
// Franchise and chain locations stay in because they compete for the same
// customer. Directories, review sites, marketplaces and product brands are
// excluded because they do not; the business's own names are excluded because
// the model otherwise returns them about one answer in ten.
const EXTRACTOR_SYSTEM = `You extract the names of businesses recommended in an AI-generated answer.
Return the name of every specific business, company, firm, shop, studio, restaurant, contractor, practice, clinic or provider the ANSWER recommends or names as an option, in the order they first appear. Keep franchise and chain locations (Roto-Rooter, Mr. Rooter, Jiffy Lube, Molly Maid) when the ANSWER recommends them: they compete for the same customer.
Do NOT include: the business listed under EXCLUDE (in any spelling); directories, review sites, marketplaces or apps (Yelp, Google Maps, Angi, Thumbtack, Houzz, Nextdoor, TripAdvisor, OpenTable, DoorDash, Zillow, Avvo, RealSelf, Groupon, Amazon); a product or parent brand named only to describe something else ("a Toyota dealer" names Toyota as a product, "Botox" is a product); generic categories ("a local plumber"); people who are not businesses.
Use the business's name exactly as written in the ANSWER, minus any trailing location or descriptor.
If a business is already on the KNOWN COMPETITORS list under any spelling, output the KNOWN spelling exactly as listed.
Output ONLY a JSON array of strings (no prose). If no businesses are named output [].`;

export async function extractCompetitors(args: {
  answer: string;
  businessNames: string[];
  knownCompetitors: string[];
}): Promise<string[]> {
  const env = loadEnv();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
      "content-type": "application/json" },
    body: JSON.stringify({
      model: env.JUDGE_MODEL, max_tokens: 500, system: EXTRACTOR_SYSTEM,
      messages: [{ role: "user", content:
        `EXCLUDE:\n${args.businessNames.join("\n")}\n\n` +
        `KNOWN COMPETITORS:\n${args.knownCompetitors.join("\n") || "(none yet)"}\n\n` +
        `ANSWER:\n${args.answer}` }],
    }),
  });
  if (!res.ok) throw new Error(`extractor ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("");
  return parseCompetitorOutput(text);
}
