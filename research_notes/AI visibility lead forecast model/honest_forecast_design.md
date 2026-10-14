# Honest forecast design: building, presenting and verifying a rough customer-and-revenue forecast (US, as of October 2026)

Research date: 13 October 2026. This is research, not legal advice. Points marked **[LAWYER]** should be reviewed by a US advertising lawyer before launch.

Reliability notes for the report writer:
- Several primary pages could not be opened (Zillow's Zestimate page returned 403; the FTC's January 2025 press release URL returned 404; Google's Project Sunroof methodology page returned empty; the FTC ".com Disclosures" page returned only navigation). Where that happened the finding is taken from a search-result excerpt or a secondary source and is labelled as such.
- Almost all numbers about AI referral traffic come from vendor blogs and vendor studies, not independent research. They conflict with each other. Treat them as rough.
- Worked arithmetic in the "Inferences" blocks is my own, not from a source.

---

## 1. Standard ways to forecast with uncertain inputs, and which suits a funnel of five or six multiplied rates

### Takeaway
Use a three-point (low / likely / high) range for each funnel step, combine them with a small Monte Carlo simulation (or the equivalent log-normal shortcut), and report the middle and an 80% or 90% range. Never multiply all the lows together and all the highs together: with six steps that overstates the spread by roughly fifty times. Pick each default rate from a reference class of similar businesses, then update toward the customer's own data as it arrives.

### Cited Findings
- Hubbard ("How to Measure Anything") defines a 90% confidence interval as a range the estimator believes has a 90% chance of containing the true value, with "a 5% chance the true value could be greater than the upper bound, and a 5% chance it could be less than the lower bound." — [LessWrong summary of How to Measure Anything](https://www.greaterwrong.com/posts/ybYBCK9D7MZCcdArB/how-to-measure-anything) (secondary summary of the book; date of summary not captured)
- People are overconfident when giving ranges: in one study cited in that summary, the true value fell inside subjects' 90% intervals only about 50% of the time. Hubbard's fixes are the "equivalent bet" test and repeated practice with feedback. — [LessWrong summary of How to Measure Anything](https://www.greaterwrong.com/posts/ybYBCK9D7MZCcdArB/how-to-measure-anything)
- Hubbard's method feeds calibrated ranges into Monte Carlo simulation and Bayesian updating to produce a range of probable outcomes rather than "high, medium, or low" ratings. — [Shortform summary of How to Measure Anything](https://www.shortform.com/pdf/how-to-measure-anything-pdf-douglas-w-hubbard) (secondary)
- Reference-class forecasting (Flyvbjerg, building on Kahneman and Tversky) takes the "outside view": treat the case as one member of a class of similar past cases. Three steps: (1) identify enough similar past cases, (2) build the distribution of their actual outcomes, (3) place the current case within that distribution, adjusting only for features that are truly distinctive. — [Reference Class Forecasting concept page](https://concepts.dsebastien.net/concept/reference-class-forecasting/) (secondary); original paper: [Flyvbjerg, "From Nobel Prize to Project Management", Project Management Journal, 2006](https://risknet.de/fileadmin/eLibrary/Flyvbjerg-Nobel-PMJ2006.pdf)
- The motivation: inside-view forecasts are systematically optimistic. Flyvbjerg's data is reported as average cost-forecast inaccuracy of 44.7% for rail, 33.8% for bridges and tunnels, 20.4% for roads. — [PMI, "Planning for the planning fallacy", 2019](https://www.pmi.org/learning/library/planning-fallacy-causes-solutions-project-expectations-6374) (figures as relayed by search summary; verify against the 2006 paper before quoting)
- A 2025 critical review notes open questions about reference-class forecasting's validity and limits; the choice of reference class is itself a judgment call. — [Cranfield University repository, critical review](https://dspace.lib.cranfield.ac.uk/server/api/core/bitstreams/076d9c29-659d-4bfd-9b1b-e0019ea9ad20/content) (as summarised in search; not read in full)
- Bayesian updating for rates: a conversion rate is a binomial quantity, whose convenient prior is a beta distribution; the updated estimate is just prior successes and failures plus observed successes and failures. — [Count Bayesie, "Parameter estimation: adding Bayesian priors", April 2015](https://www.countbayesie.com/blog/2015/4/4/parameter-estimation-adding-bayesian-priors)
- Small samples produce extreme rates by chance; shrinkage pulls them toward the group average, with weight on the prior equal to kappa / (kappa + n), where kappa is the prior's "pseudo-count" and n is the customer's sample size. — [MetricGate, Empirical Bayes docs, March 2025](https://metricgate.com/docs/empirical-bayes/); [Skeptric, "Pooling proportions with empirical Bayes"](https://skeptric.com/pooling-proportions-empirical-bayes/)

### Inferences
- **Which method for a multiplied funnel.** A Mirror funnel looks like: buyer questions asked per month x share asked to AI tools x share of answers that name the business x share who click or look the business up x share who become a lead x share who become a customer x value per customer. That is a product of six or seven uncertain numbers. The natural tools are (a) Fermi decomposition to define the steps, (b) three-point ranges per step, (c) Monte Carlo (10,000 random draws, trivial in TypeScript) to combine them, (d) reference-class defaults by industry for each step, (e) Bayesian shrinkage to move defaults toward each customer's observed rates.
- **Why multiplying lows and highs overstates the spread (my arithmetic).** Suppose each of six independent steps has a 90% range where the high is 3x the low. Multiplying all lows and all highs gives a top-to-bottom spread of 3^6 = 729x. But for all six to sit at or below their 5th-percentile at once has probability 0.05^6, about 1 in 64 million, so that "low" is not a 5%-case, it is a near-impossible case. Treating each step as log-normal, the uncertainties add in log space as a square root: the true 90% spread of the product is 3^(sqrt 6) = 3^2.45, about 14.7x. So the naive method overstates the spread by about 50x. General rule: if every step has the same high/low ratio r, the correct combined ratio is r^sqrt(n), not r^n.
- **Shortcut without simulation.** For each step take ln(high/low); square each; add; take the square root; exponentiate. That is the combined high/low ratio for the same confidence level. The combined "likely" value is the product of each step's geometric middle, sqrt(low x high).
- **Two caveats to that maths.** (1) It assumes steps are independent. If steps move together (for example a strong brand raises both mention rate and conversion), the true spread is wider; Monte Carlo with a shared "business quality" factor handles this, and the honest fallback is to widen the range. (2) A product of uncertain numbers is right-skewed: the average is above the median (by about 40% in the example above, exp(sigma^2/2) with sigma about 0.82). Show the median as the headline "likely" number, not the mean, or the headline will be inflated by rare big outcomes.
- **Use 80% ranges, widened.** Given documented overconfidence (true values land in "90%" ranges about half the time), first-version ranges set by the team should be deliberately wider than feels natural, and labelled as roughly "8 in 10" until backtesting shows the real hit rate.
- **Rates must be bounded.** Draw rates from a beta or a clipped log-normal so a simulated conversion rate can never exceed 100%.

### Gaps
- I did not retrieve a primary citation for the log-normal "square root of n" rule for products of ranges; it is standard statistics (variances of independent logs add) but the report writer should treat the worked example as my own derivation.
- Tetlock ("Superforecasting") was named in the brief; I did not retrieve a source for specific Tetlock findings (base rates first, small frequent updates, Brier scoring), so none are cited here.
- No public reference-class data exists that I found for the specific rates Mirror needs (share of local buyer questions asked to AI, click-through from an AI mention to a business). These defaults will have to be set from vendor studies (section 6) plus Mirror's own customers, and that weakness should be stated on the page.

---

## 2. Showing ranges to non-experts: understood and trusted?

### Takeaway
The best available evidence says a numeric range slightly lowers people's confidence in the exact number but does not meaningfully reduce trust in the source, and performs better than a vague verbal caveat. So show "about 6 (likely between 2 and 15)", not a bare "6" and not "results may vary".

### Cited Findings
- van der Bles, van der Linden, Freeman and Spiegelhalter (PNAS, 2020) ran five surveys in the UK, total n = 5,780, comparing a bare number, a number with a numeric range, and a number with a verbal statement that uncertainty exists. — [AI Impacts paper summary](https://blog.aiimpacts.org/p/paper-summary-the-effects-of-communicating) (secondary); paper DOI: [10.1073/pnas.1913678117](https://doi.org/10.1073/pnas.1913678117)
- Result as summarised: stating uncertainty numerically makes people somewhat less certain about the number itself but does not cause loss of trust in the source. — [AI Impacts paper summary](https://blog.aiimpacts.org/p/paper-summary-the-effects-of-communicating)
- The Winton Centre's own announcement: communicating uncertainty "did not undermine their trust in the facts or in the communicator", "particularly when the uncertainty was in the form of an actual numerical range, rather than a verbal caveat." The work included experiments on the BBC News website. — [Winton Centre for Risk and Evidence Communication, University of Cambridge](https://wintoncentre.maths.cam.ac.uk/news/being-upfront-about-your-uncertainty-doesnt-necessarily-mean-you-lose-your-audiences-trust-new-paper-published) (page undated; paper is 2020)
- Product example of a plain-language error statement: Zillow explains median error as "half of estimates fall within the stated percentage and half fall outside", and publishes accuracy as "X of 100 homes within 5% / 10% / 20%" of sale price (March 2025 data reproduced by a third party: 82 of 100 within 5%, 95 within 10%, 99 within 20%, for on-market homes). — [The Close, "How accurate is Zillow's Zestimate"](https://theclose.com/how-accurate-is-zillow-zestimate/) (secondary reproduction of Zillow's table)

### Inferences
- Design rules that follow: (1) lead with one "likely" number and put the range right beside it in the same type size region, not in a footnote; (2) use a numeric range, never only words like "roughly" or "may vary"; (3) express chance as natural frequencies, "in about 8 of 10 businesses like yours we would expect the real figure to fall in this range", copying Zillow's "X of 100" pattern; (4) round hard (say "5 to 15 customers", not "4.7 to 15.3") so precision does not imply accuracy; (5) show the range as a simple bar with the likely point marked.
- The PNAS study tested news-style facts (for example unemployment figures) with UK general public, not sales forecasts shown to business owners by a company with something to sell. Trust effects may differ when the source has a financial interest. This is a reason to pair the range with a published track record (section 7), which the studies did not test.
- A range also has a legal benefit: a single confident number is easier to read as a promise (section 4).

### Gaps
- I could not open the full PNAS paper, so exact effect sizes are not quoted. Verify at the DOI before citing specifics.
- I did not retrieve weather-forecast ("70% chance of rain") or medical risk-communication studies (icon arrays, natural frequencies) that the brief mentioned; the natural-frequency recommendation above rests on the Zillow example and general practice, not a cited study.
- No study found that tests ranges versus point estimates specifically in B2B sales or ROI-calculator settings.

---

## 3. Public examples of "how we calculated this" pages and what they include

### Takeaway
The strongest model is Zillow: a named estimate, a published error rate split by data quality, a plain statement that it is not an appraisal, and regular refreshes. Sunroof shows the working on the same screen as the number. HubSpot shows the weak version: aggregate customer benchmarks with a "results may differ" line, and benchmark figures that changed a lot between versions.

### Cited Findings
- Zillow publishes a nationwide median error rate separately for on-market and off-market homes. A search excerpt of Zillow's own page gives 1.83% on-market and 7.01% off-market. — [Zillow, Zestimate page](https://www.zillow.com/zestimate) (via search excerpt; page itself returned 403 to me, date of figures not confirmed)
- Other published figures differ by date: 1.78% / 7.20% attributed to an August 8, 2026 refresh (secondhand, from an estate agent's blog); 1.94% / 7.06% in 2025-era articles; about 2.4% / 7.5% on 2022 data. The numbers are refreshed regularly, and the off-market error is roughly four times the on-market error because on-market estimates use listing data. — [Naperville.com blog](https://naperville.com/?p=8569); [The Close](https://theclose.com/how-accurate-is-zillow-zestimate/)
- Zillow also publishes accuracy tables by region and notes off-market accuracy is worse where there are fewer sales. — [Zillow, Zestimate page](https://www.zillow.com/zestimate) (via search excerpt)
- Google Project Sunroof's inputs: 3-D roof models, shade from nearby trees and buildings, sun position over a year, historical cloud and temperature patterns; the user can enter their own average electricity bill; it compares 20-year savings for buying, leasing or a loan. — [Green Building Advisor, "Google launches a solar estimator"](https://greenbuildingadvisor.com/article/google-launches-a-solar-estimator); [Boston Globe, 17 Aug 2015](https://www.bostonglobe.com/business/2015/08/17/see-what-you-can-save-with-google-solar-map/CvAOl0p1lrspy2YXuaTqIL/story.html)
- Sunroof is reported to lay out its calculations and assumptions on the same screen as the savings figure. — [Boston Globe, 17 Aug 2015](https://www.bostonglobe.com/business/2015/08/17/see-what-you-can-save-with-google-solar-map/CvAOl0p1lrspy2YXuaTqIL/story.html)
- Independent check of Sunroof: the Midwest Renewable Energy Association found it good on physical solar potential but weak on prices and savings; the implied output behind one $8,000 20-year savings figure was about 2,920 kWh/year against 5,755 to 6,386 kWh/year from NREL's calculator for the same system; savings hinge on local utility rates and net-metering rules. — [MREA, "Can we trust Google's estimates?"](https://midwestrenew.org/comparing-sunroof/)
- A solar installer found a Sunroof figure hard to trace back to its inputs and unclear about system size. — [Florida Solar Design Group](https://floridasolardesigngroup.com/google-project-sunroof-can-you-trust-it)
- HubSpot's ROI material states its basis and a caveat: "based on aggregated data from 268,000+ HubSpot customers in over 135 countries. It is provided for information purposes only... results for individual businesses, including yours and HubSpot's, may differ based on your own markets, customer base, industry, geography, stage, and/or other factors." — [HubSpot ROI page](https://www.hubspot.com/roi) (via search excerpt; date not captured)
- Two snapshots of HubSpot's ROI calculator show very different benchmarks: "Typical +18%" leads and "+20%" revenue in one, "Average +164%" in another, with different customer counts and different revenue formulas. — [HubSpot ROI calculator](https://www.hubspot.com/roi-calculator) (via search excerpts of two versions)
- A HubSpot partner's calculator limits its benchmark to customers active at least 12 months and says individual results may vary. — [Resonate HubSpot ROI calculator](https://www.resonatehq.com/hubspot-roi)

### Inferences
- A checklist for Mirror's "How we got this number" page, assembled from what these pages do well and badly:
  1. One-sentence definition of what the number is and is not ("an estimate, not a promise or a guarantee").
  2. The funnel written as a sentence, then as a table: each step, the value used, its low and high, and where it came from.
  3. Which inputs are **measured** for this business (Mirror's own scan results: how often each AI tool names it), which are **supplied by the owner** (average sale value, close rate), and which are **assumed industry defaults**. Label each row.
  4. Source and date for every default.
  5. A published accuracy record once it exists, in Zillow's format ("in X of 100 forecasts the real result landed inside our range"), split by data quality (customers with connected analytics versus defaults only), mirroring Zillow's on-market / off-market split.
  6. "What is not counted" (section 8).
  7. "What would change this number" - the two or three inputs that move it most.
  8. Let the owner edit inputs and see the number change (Sunroof's bill input).
  9. Date last updated and a change log, because benchmarks move (the HubSpot snapshots show how much).
- The Sunroof critique is a warning that directly applies: the physical measurement (for Mirror, the AI-mention scan) can be solid while the money conversion on top of it is weak. Present the measured part and the money part as visibly separate layers.
- "Average +164%" versus "Typical +18%" shows why the word matters: an average dragged up by a few big winners is not what a typical customer gets. Use median and say so.

### Gaps
- Could not open Zillow's page to quote its exact "not an appraisal" wording or confirm the current figures and their date. The report writer should not present any single Zillow figure as current without checking.
- Could not open Google's Sunroof methodology page; no exact disclaimer wording captured.
- Did not find or review credit-score explainers (FICO, VantageScore), Semrush ROI calculators or carbon calculators.

---

## 4. What US law requires for results, savings and earnings claims

### Takeaway
The binding law for Mirror is the FTC Act section 5 (no deceptive claims) plus the substantiation doctrine: you must hold objective evidence for every claim, express or implied, before you publish it, and fine print cannot rescue a misleading headline. The business-opportunity and earnings-claim rules are mostly aimed at people selling ways to make money and, as of October 2026, the 2025 expansion proposals are not final. The FTC does act when small businesses are the ones misled, including about lead quality, and has ordered an AI company to stop making accuracy claims it could not back up.

### Cited Findings

**Section 5 and substantiation**
- An ad is deceptive if it "is likely to mislead consumers acting reasonably under the circumstances" and the claim is material. — [FTC, "Advertising FAQ's: A Guide for Small Business"](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business) (published April 2001, edited January 2025)
- "Under the law, advertisers must have proof to back up express and implied claims that consumers take from an ad." An implied claim is "one made indirectly or by inference." — [FTC, Advertising FAQ's](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business)
- "A 'reasonable basis' means objective evidence that supports the claim." "The law requires that advertisers have proof before the ad runs." — [FTC, Advertising FAQ's](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business)
- "The reasonable basis doctrine requires that firms have substantiation before disseminating a claim." Factors for how much evidence is needed: "the type of claim, the product, the consequences of a false claim, the benefits of a truthful claim, the cost of developing substantiation for the claim, and the amount of substantiation experts in the field believe is reasonable." — [FTC Policy Statement Regarding Advertising Substantiation, 23 November 1984](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation)
- If an ad states a level of support (for example "studies show"), "the Commission expects the firm to have at least the advertised level of substantiation." — [FTC Policy Statement Regarding Advertising Substantiation, 1984](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation)
- "Offering a money-back guarantee is not a substitute for substantiation." — [FTC, Advertising FAQ's](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business)
- Ad agencies "have a duty to make an independent check on the information used to substantiate ad claims" and "may not rely on an advertiser's assurance that the claims are substantiated." — [FTC, Advertising FAQ's](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business)
- Violating a cease-and-desist order can cost "$53,088 per day per ad" (figure as adjusted January 2025). Competitors can also sue over deceptive ad claims under the Lanham Act. — [FTC, Advertising FAQ's](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business)

**Disclaimers**
- "Nor can advertisers use fine print to contradict other statements in an ad or to clear up misimpressions that the ad would leave otherwise." Example: a fine-print "Diet and exercise required" was "insufficient to remedy the deceptive claim in the ad." — [FTC, Advertising FAQ's](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business)
- Disclosures must be "presented clearly and conspicuously so that consumers can actually notice and understand it"; online disclaimers must also be "clear and conspicuous." — [FTC, Advertising FAQ's](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business)
- The FTC's detailed online-disclosure guidance is ".com Disclosures: How to Make Effective Disclosures in Digital Advertising", March 2013. — [FTC, .com Disclosures](https://www.ftc.gov/business-guidance/resources/com-disclosures-how-make-effective-disclosures-digital-advertising) (page text did not load; only title and date confirmed)

**Endorsements, testimonials and typicality**
- The Endorsement Guides (16 CFR Part 255) "were revised in 2023." If an advertiser lacks proof that an endorser's experience is what people generally get, the ad "must make clear to the audience what the generally expected results" are. — [FTC, "FTC's Endorsement Guides: What People Are Asking"](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking) (page undated in captured text)
- "You shouldn't make claims about a product that would require proof the advertiser doesn't have", and endorsers themselves "may be liable for misleading or unsubstantiated statements about a product's performance or effectiveness." — [FTC, Endorsement Guides FAQ](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)

**Business Opportunity Rule and earnings-claim rulemaking (status)**
- The existing Business Opportunity Rule, 16 CFR Part 437, is in force; sellers of covered business opportunities must give a one-page disclosure document at least seven days before the buyer signs or pays. — [eCFR, 16 CFR Part 437](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-437); [FTC, "Selling a Work-at-Home or Other Business Opportunity? Revised Rule May Apply to You"](https://www.ftc.gov/business-guidance/resources/selling-work-home-or-other-business-opportunity-revised-rule-may-apply-you-1)
- On 13 January 2025 the FTC announced two Notices of Proposed Rulemaking and one Advance Notice: (a) expand the Business Opportunity Rule to "money-making opportunities" such as business coaching and investment programmes, banning material misrepresentations and requiring written substantiation for earnings claims, available on request; (b) a new Earnings Claim Rule limited to multi-level marketing. Vote was 3-2 on party lines. — [Hunton, "FTC issues three notices..."](https://hunton.com/hunton-retail-law-resource/ftc-issues-three-notices-for-changes-to-the-business-opportunity-rule-and-a-new-rule-on-multi-level-marketing-mlm-practices); [Lathrop GPM](https://www.lathropgpm.com/insights/ftc-proposes-changes-to-deter-deceptive-earnings-claims-by-multilevel-marketers-and-money-making-opportunity-sellers/); [Kelley Drye, Ad Law Access](https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/ftc-puts-pedal-to-the-metal-to-release-proposed-rule-on-mlm-earnings-claims-changes-to-business-opportunity-rule-but-republican-commissioners-pump-the-brakes-in-potential-foreshadowing) (January 2025)
- Status as of September-October 2026: **proposed, not final.** A tracking page dated September 2026 says "There's no final FTC earnings claim rule", that the January 2025 MLM earnings-claim proposal "was released but never published in the Federal Register", and that the regulatory agenda lists it "at the pre-rule stage". No final rule and no formal withdrawal is reported for either rulemaking. — [MMOL Database, "The rules", updated September 2026](https://mmoldatabase.com/the-rules.html) (non-official tracker; single source)
- A Federal Register regulatory agenda dated 14 August 2026 still lists the Business Opportunity Rule among rulemakings likely to affect small entities. — [Federal Register, Regulatory Agenda, 14 Aug 2026](https://www.federalregister.gov/documents/2026/08/14/2026-16617/regulatory-agenda) (stage and target dates not visible in the excerpt)

**Enforcement that bears on Mirror**
- HomeAdvisor (January 2023): FTC order requiring payment of up to $7.2 million and an end to deceptive marketing of home-improvement **leads sold to service providers**, i.e. the misled parties were small businesses buying leads. — [FTC press release, January 2023](https://www.ftc.gov/news-events/news/press-releases/2023/01/ftc-order-requires-homeadvisor-pay-72-million-stop-deceptively-marketing-its-leads-home-improvement)
- Workado (final order approved 28 August 2025, 3-0): the company advertised its AI content detector as 98% accurate; FTC alleged testing showed about 53% on general text. The order bars accuracy or efficacy claims unless they are not misleading and backed by "competent and reliable evidence" at the time they are made, requires keeping that evidence, notifying customers, and compliance reports for about four years. — [Frankfurt Kurnit, "FTC's AI crackdown continues: Workado..."](https://advertisinglaw.fkks.com/post/102l358/ftcs-ai-crackdown-continues-workado-ordered-to-drop-unsupported-accuracy-claims); proposed order: [Federal Register, 2 May 2025](https://www.govinfo.gov/content/pkg/FR-2025-05-02/html/2025-07617.htm); final-order report: [MyChesCo](https://www.mychesco.com/a/news/national/ftc-finalizes-order-restricting-workados-ai-content-detection-claims/)
- Earnings-claim sweep against "AI-powered" money-making schemes: Click Profit (August 2025 proposed settlement with permanent industry ban and asset turnover), Ascend Ecom (complaint alleged none of its clients earned the advertised income; proposed order bans operators from selling business opportunities), Growth Cave (pending). Common features: bold income guarantees, inflated testimonials, "automated/AI" framing. — [Frankfurt Kurnit, "FTC shuts down AI-driven business opportunity scheme..."](https://advertisinglaw.fkks.com/post/102kymz/ftc-shuts-down-ai-driven-business-opportunity-scheme-continues-sweep-of-deceptiv); [WilmerHale, 15 Oct 2024](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20241015-the-ftc-cracks-down-on-unfair-and-deceptive-practices-involving-the-use-of-ai)
- Lead-generation cases generally (Career Education Corp 2019, $30 million; MediaAlpha 2025): the FTC holds companies responsible for deceptive claims in how leads are generated and sold. — [Venable, July 2023](https://www.venable.com/insights/publications/2023/07/ftc-settlements-with-lead-generators-offer); [FTC business blog on MediaAlpha, August 2025](https://www.ftc.gov/business-guidance/blog/2025/08/if-youre-deceiving-consumers-ftc-means-business-exploring-recent-settlement-mediaalpha)

**State law**
- California Business and Professions Code section 17500 prohibits untrue or misleading statements, including online, that the speaker "knew or should have known" were untrue or misleading; violation is a misdemeanor (up to six months in county jail and/or a fine up to $2,500). It is usually pleaded together with the Unfair Competition Law, section 17200. — [Justia, Cal. Bus. & Prof. Code 17500 (2024 code)](https://law.justia.com/codes/california/code-bpc/division-7/part-3/chapter-1/article-1/section-17500)
- California's Seller Assisted Marketing Plan Act regulates sellers of business opportunities to inexperienced buyers (registration, cancellation notices, escrow rules); the state Attorney General has enforced it. — [California Attorney General press release](https://oag.ca.gov/news/press-releases/attorney-general-lockyer-files-lawsuit-against-california-company-nationwide)

### Inferences
- **The forecast is an advertising claim the moment a prospect sees it.** The free-audit version is marketing. Under the FAQ wording, Mirror needs objective evidence for the express claim ("likely 6 more customers") and for what a reasonable owner would take from it ("if I pay Mirror I will get about 6 more customers"). The second, implied claim is the dangerous one, because the forecast estimates what better AI visibility *could* produce, not what Mirror's service *will* deliver.
- **Keep a substantiation file before launch.** For each default rate: the source, the date, why it applies to this industry, and the simulation output. Workado's order shows what regulators require after the fact (evidence at the time of the claim, kept on file); do it up front. **[LAWYER]**
- **Stating a confidence level is itself a claim.** Under the 1984 statement, saying "80% likely range" means Mirror needs at least that level of support. Until backtesting exists, word it as "our estimated range" or "our best estimate of the likely range", not as a measured probability or a "proven" accuracy figure. Do not print an accuracy percentage for the forecast until it has been measured. **[LAWYER]**
- **Disclaimers that do not work:** a footer "results not guaranteed" or "results may vary" under a big confident number; a disclaimer on a separate page or behind a link; any disclaimer that contradicts the headline. **What works:** putting the qualification inside the claim itself (the range, the word "estimate", "if AI visibility improves to X"), same screen, same visual weight region, in plain words.
- **Testimonials and case studies next to the forecast** must reflect typical results or state the generally expected result. A best-customer story placed beside a prospect's forecast turns the forecast into an implied promise.
- **Business Opportunity Rule: probably not applicable to Mirror, but confirm.** Mirror sells a measurement and improvement service to an existing business; it is not selling a new business or a money-making programme. The 2025 expansion proposal (coaching, "money-making opportunities") is the one to watch, because broad wording could arguably touch services marketed with income projections, and it is not final as of October 2026. **[LAWYER]**
- **B2B is not a safe harbour.** HomeAdvisor shows the FTC treats small-business buyers as protected when sold on inflated lead claims; state laws and competitor Lanham Act suits add exposure. Small and mid-size business owners are exactly the audience regulators treat as unsophisticated.
- **Contract terms:** a forecast shown inside a paid dashboard could also be argued to be a warranty or a misrepresentation in a contract dispute. Terms of service should say forecasts are estimates and not guarantees, but per the FTC that language supports, and does not replace, honest presentation. **[LAWYER]**

### Gaps
- I found **no FTC action specifically against an SEO or marketing agency for inflated ROI or "guaranteed leads" forecasts**. The closest analogues are HomeAdvisor (lead quality sold to small businesses) and Workado (unsupported AI accuracy claim). Absence of a found case is not proof none exists.
- I did not read the HomeAdvisor complaint or order; only the press-release title was confirmed. The specific misrepresentations alleged should be read at the FTC link before being described in detail.
- The FTC's own January 2025 press release could not be opened (404 at the URL I tried); rule details come from law-firm summaries. The October 2026 status rests on one unofficial tracker plus a regulatory-agenda listing; confirm at reginfo.gov (RINs reported as 3084-AB04, 3084-AB65, 3084-AB70) before stating it firmly.
- Exact wording from the 2013 ".com Disclosures" guidance (proximity, hyperlinks) was not retrieved.
- State law coverage is thin: only California was checked, and I could not confirm how section 17500 or other states' unfair-practices laws apply to business-to-business forecasts. Not checked: FTC "Operation AI Comply" details, FTC Notices of Penalty Offenses on money-making claims, state business-opportunity statutes outside California. **[LAWYER]**

---

## 5. How agencies and SaaS companies word ROI forecasts in practice

### Takeaway
Common practice is: call it an estimate or projection, state the data it is based on, let the user enter their own inputs, and add "results may differ" language. Common practice is weaker than the FTC standard, so copy the structure but not the reliance on a caveat line.

### Cited Findings
- HubSpot describes its calculator as using "your inputs to project results based on real customer benchmarks", and its ROI report as "provided for information purposes only" with results that "may differ based on your own markets, customer base, industry, geography, stage, and/or other factors." — [HubSpot ROI calculator](https://www.hubspot.com/roi-calculator); [HubSpot ROI page](https://www.hubspot.com/roi) (via search excerpts)
- HubSpot labels benchmark figures with the words "Typical" or "Average" and states the basis (for example, increase seen after one year of ownership; revenue computed from lead volume, lead-to-deal close rate and deal size). — [HubSpot ROI calculator](https://www.hubspot.com/roi-calculator) (via search excerpts)
- A partner calculator restricts the benchmark population (customers active at least 12 months) and says individual results may vary. — [Resonate](https://www.resonatehq.com/hubspot-roi)
- The FTC position that sits over all of this: fine print cannot "clear up misimpressions that the ad would leave otherwise." — [FTC, Advertising FAQ's](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business)

### Inferences
- Wording patterns that fit both practice and the FTC standard (my drafts, for a lawyer to review **[LAWYER]**):
  - Headline: "Estimated extra customers per month if AI tools recommended you as often as [top competitor]: about 6 (likely range 2 to 15)."
  - Sub-line: "This is an estimate, not a promise. It is built from your scan results, the numbers you gave us, and industry averages. Here is the working."
  - On assumptions: "We assumed X. If your real figure is different, change it here."
  - On Mirror's role: "This shows the size of the opportunity. It does not predict what any service, including ours, will achieve."
- Words to avoid: "guaranteed", "will", "you are losing $X" stated as fact, "proven", "up to" (invites the top of the range as the headline), any accuracy percentage not yet measured, and "typical results" unless Mirror has data on what its typical customer got.
- Conditional framing ("if visibility rises from 10% to 30% of answers") is safer and more honest than unconditional framing, because the condition is the thing Mirror measures and can later verify.
- "Lost revenue" framing in a free audit ("you are losing $4,000 a month to competitors") is a stronger factual claim than "opportunity" framing and needs the same evidence; prefer the opportunity framing with a range.

### Gaps
- I did not find law-firm guidance specifically on wording SaaS ROI calculators or agency proposals, nor examples of agency contract clauses on projections. Semrush and agency examples were not reviewed.
- HubSpot's on-page calculator disclaimer text was not visible in what I retrieved.

---

## 6. Measuring AI-referred traffic and leads so the forecast can be checked

### Takeaway
No single method sees most AI influence. Click tracking in GA4 catches only the visits that carry a referrer, and vendor studies suggest somewhere between a third and 70% of AI-driven visits arrive unlabelled; many AI-influenced buyers never click at all and instead search the brand name or phone. Use several cheap signals together: a GA4 AI channel, a mandatory "How did you hear about us?" field, call tracking, branded-search trend and Google Business Profile actions.

### Cited Findings

**GA4 referrers**
- GA4 treats a visit with no referrer as Direct. A custom channel group using a referrer pattern such as `^(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)` separates the AI visits that do carry a referrer. — [Seybold, "Measure AI traffic in GA4" guide](https://seybold.de/en/guide/ai-traffic-google-analytics-4/); [Nadia Mohamed, "Track AI referral traffic in GA4: 2026 guide"](https://nadiamohamed.me/insights/track-ai-referral-traffic/) (practitioner blogs)
- Clicks from Google AI Overviews and from Gemini inside google.com are filed as ordinary Google organic search, so a referrer filter cannot separate them. — [AuthorityTech, "AI search traffic conversion measurement 2026"](https://authoritytech.io/curated/ai-search-traffic-conversion-measurement-2026) (vendor blog)
- Share missed, per vendors: Loamly reports 70.6% of confirmed AI-referred traffic arrives without referrer headers; Attrifast reports 71% of ChatGPT visits land in GA4 as Direct across 41.2 million sessions; another source gives a range of 35% to 70%. — [The Digital Bloom, Gen AI website traffic share report, Feb 2026](https://thedigitalbloom.com/learn/gen-ai-website-traffic-share-february-2026/); [AuthorityTech, "Invisible AI search referral traffic attribution in GA4", 2026](https://authoritytech.io/curated/ai-search-traffic-invisible-attribution-analytics-measurement-2026) (all vendor sources; methods not independently verified)
- Size of the channel today: AI referrals are around 1% of web traffic or less. Reported figures: 0.89% of total traffic (May 2026); 1.08% (April 2026, up 623% year on year); 0.25% of referrals worldwide on Statcounter data (August 2026). These use different denominators. — [Crispy Content, "AI referral traffic 2026"](https://www.crispycontent.de/en/blog/ai-referral-traffic-chatgpt-growth-impact-b2b-brands-2026); [upGrowth, "AI traffic share report 2026"](https://upgrowth.in/ai-traffic-share-report-2026/)
- ChatGPT sends most of it: estimates from about 64.5% to 79.4% of AI referrals in 2026; one breakdown gives ChatGPT 79.4%, Gemini 10.9%, Perplexity 4.3%, Copilot 2.8%, Claude 2.6%. — [upGrowth](https://upgrowth.in/ai-traffic-share-report-2026/); [The Digital Bloom](https://thedigitalbloom.com/learn/gen-ai-website-traffic-share-february-2026/)
- Conversion quality: Seer Interactive's single-client study (1 Oct 2024 to 30 Apr 2025) found conversion rates of 15.9% for ChatGPT, 10.5% Perplexity, 5% Claude, 3% Gemini, against 1.76% for Google organic, on under 11,000 AI sessions versus almost 14 million organic. It is one site and one conversion definition, and should not be generalised. — [Seer Interactive, "Case study: 6 learnings about how traffic from ChatGPT converts"](https://www.seerinteractive.com/insights/case-study-6-learnings-about-how-traffic-from-chatgpt-converts)
- Another vendor figure: AI-referred sign-up conversion 1.66% versus 0.15% for organic search. — [The Digital Bloom, Feb 2026](https://thedigitalbloom.com/learn/gen-ai-website-traffic-share-february-2026/)

**Branded search**
- A Similarweb-based analysis found 55.9% of AI-influenced visits arrived through branded search, against 40.4% in a non-AI control group, suggesting much of the AI effect shows up as people searching the business name. — [The Digital Bloom, Feb 2026](https://thedigitalbloom.com/learn/gen-ai-website-traffic-share-february-2026/) (vendor relay of Similarweb analysis)

**Self-reported attribution**
- Docebo uses a mandatory "How did you hear about us?" free-text field on its demo form and classifies the answers with a language model. In Q3 2025, "12.7% of high-intent leads... specifically mentioned AI tools as their discovery source", about 5x Q3 2024 and 10x Q1 2024. — [Kyle Poyar, Growth Unhinged, "AI discovery playbook", 8 Oct 2025](https://kylepoyar.substack.com/p/ai-discovery-playbook)
- Same article: "Click-based attribution methods might lump all search traffic together, even if the search behavior isn't really what influenced the buyer." Docebo also saw a 26% drop in clicks when an AI Overview appeared. — [Growth Unhinged, 8 Oct 2025](https://kylepoyar.substack.com/p/ai-discovery-playbook)

**Call tracking**
- CallRail reported AI search as the source of 0.073% of inbound calls (January 2026 release, about 20 million leads), rising to 0.115% in H1 2026 (about 30 million calls since November 2025), a 58% rise. Highest early shares: legal 0.175%, manufacturing 0.093%, marketing agencies 0.091%. — [CallRail release via MarTech Cube, "Analysis of 20M leads..."](https://www.martechcube.com/?p=287309); [CallRail checklist PDF](https://cdn.mediavalet.com/usva/callrail/8utGVvVvo0eOT3x9St5jBw/vsUqe3s5v0qnns6SWLsNYA/Original/CallRail_AI%20search%20is%20already%20sending%20calls%20to%20businesses_Checklist.pdf) (vendor marketing material)
- Invoca's 2026 benchmarks: calls referred by ChatGPT converted to sales leads at 49%. — [PPC Land](https://ppc.land/chatgpt-calls-convert-to-leads-at-49-beating-every-channel-invoca-finds/)

**Server logs and AI agents**
- OpenAI documents separate user agents: GPTBot (training), OAI-SearchBot (ChatGPT search index), ChatGPT-User (fetches triggered by a user's request, "not used for crawling the web in an automatic fashion"), and OAI-AdsBot (checks ad landing pages). — [OpenAI developer docs, "Overview of OpenAI crawlers"](https://developers.openai.com/api/docs/bots)

**Google Business Profile**
- Google defines Calls as clicks on the call button and Website clicks as clicks on the website link on the Business Profile; it changed how direction requests are counted in 2023 to remove multi-taps, cancellations and spam. Data can lag 3 to 4 days. — [Google Business Profile Help, "Track your Business Profile performance"](https://support.google.com/plus/answer/3154834?hl=en); [Google Merchant Center Help](https://support.google.com/merchants/answer/13053930?hl=en)

### Inferences
- **How big is the gap between methods?** Compare two numbers measured in different ways (not the same companies, so indicative only): AI is about 1% or less of tracked web traffic and 0.1% of tracked calls, yet 12.7% of one B2B software company's demo leads said AI was how they found it. Even allowing that Docebo is an unusually AI-visible software brand, the lesson is that click and call tracking alone can understate AI influence by a large multiple, and that self-report is the single most informative low-cost signal.
- **A layered measurement plan a small team can build:**
  1. GA4 custom channel "AI assistants" by referrer pattern, plus counting landing-page URLs with `utm_source=chatgpt.com`. Lower bound of AI visits.
  2. One mandatory "How did you hear about us?" field with "AI assistant (ChatGPT, Gemini, etc.)" as an option plus free text, on every lead form and asked on the phone. Best single signal for small businesses.
  3. Branded-search clicks and impressions in Search Console as a trend line beside Mirror's AI-mention rate. Supporting evidence only; many other things move brand search.
  4. Google Business Profile calls, website clicks and direction requests, same treatment. Important for local businesses whose buyers go from an AI answer straight to Maps or the phone.
  5. Server-log counts of ChatGPT-User fetches as a rough sign that the site is being pulled into live answers. A signal of exposure, not of leads.
  6. Call tracking only where the customer already has it.
- **State the blind spot on the page.** Something like: "We can directly track only some AI-driven visits. Outside studies suggest a large share, possibly more than half, arrive unlabelled or come later through a search for your name or a phone call." Do not publish a precise "we miss X%" figure; the sources do not support one.
- **Forecast the thing you can check.** Split the forecast into (a) "trackable AI leads" (GA4 AI channel plus self-reported AI), which can be scored against reality, and (b) "estimated total including untracked", shown as a wider, clearly labelled extrapolation. Only (a) can honestly be verified.
- **Do not copy the 16% ChatGPT conversion rate into defaults.** It is one site. Start AI-visit conversion at the customer's own site-wide rate and widen the range upward.

### Gaps
- **No independent (non-vendor, peer-reviewed) study** was found for the share of AI influence that tracking misses. The 35% to 71% "unlabelled" figures all come from companies selling attribution tools.
- No study found measuring what share of **small local business** customers self-report AI as their source; Docebo is one mid-market B2B software company.
- I did not confirm from an official source that ChatGPT appends `utm_source=chatgpt.com` to outbound links (widely reported by practitioners; the OpenAI crawler page does not mention it).
- Search Console's branded-query filtering and whether Search Console separates AI Overview or AI Mode clicks as of October 2026 were not confirmed.
- User-agent documentation for Perplexity, Anthropic (Claude), Google (Gemini) and xAI (Grok) crawlers was not retrieved.
- What CallRail's "AI-driven call" classification relies on (referrer of the web session before the call) was not confirmed; if so it inherits the same missing-referrer blind spot.

---

## 7. Recalibrating the forecast as real data arrives

### Takeaway
Store every forecast with its date, inputs and range; later compare it with what happened; publish the hit rate; and blend default rates with each customer's own observed rates in proportion to how much data they have. For small lead counts, avoid MAPE as the main score and use "did the actual land inside the range" plus absolute error.

### Cited Findings
- Forecast accuracy must be judged on "how well a model performs on new data that were not used when fitting the model"; "A model which fits the training data well will not necessarily forecast well." — [Hyndman and Athanasopoulos, Forecasting: Principles and Practice (3rd ed.), section on evaluating accuracy](https://otexts.com/fpp3/accuracy.html)
- Backtesting should use a rolling origin with "no future observations" in the data used to make each forecast. — [Forecasting: Principles and Practice](https://otexts.com/fpp3/accuracy.html)
- MAPE's problems: percentage errors are "infinite or undefined if y_t = 0", have "extreme values if any y_t is close to zero", and "put a heavier penalty on negative errors than on positive errors." The authors recommend not using sMAPE. — [Forecasting: Principles and Practice](https://otexts.com/fpp3/accuracy.html)
- Mean absolute error is "easy to both understand and compute" but is on the scale of the data so cannot compare businesses of different sizes; scaled errors compare a forecast against a naive forecast, with a value under one meaning the forecast beat the naive method. — [Forecasting: Principles and Practice](https://otexts.com/fpp3/accuracy.html)
- Shrinkage: the blended rate weights the prior by kappa / (kappa + n). With a beta prior the update is "add observed successes and failures to the prior's parameters." — [MetricGate, Empirical Bayes](https://metricgate.com/docs/empirical-bayes/); [Count Bayesie, 2015](https://www.countbayesie.com/blog/2015/4/4/parameter-estimation-adding-bayesian-priors)
- The prior can be estimated from all groups (all customers in an industry) by matching mean and variance or by maximum likelihood; the simple method can be unstable when sample sizes differ a lot. — [Skeptric, "Pooling proportions with empirical Bayes"](https://skeptric.com/pooling-proportions-empirical-bayes/); [arXiv 1904.12918, "Shrinkage estimators in online experiments"](https://arxiv.org/pdf/1904.12918)
- Zillow's model of published accuracy: a median error, refreshed periodically, split by data-rich and data-poor cases, plus "X of 100 within 5/10/20%". — [Zillow](https://www.zillow.com/zestimate) (via search excerpt); [The Close](https://theclose.com/how-accurate-is-zillow-zestimate/)

### Inferences
- **Why MAPE fits badly here.** A small business may get 0 to 5 AI-attributed leads a month. With actual = 0, MAPE is undefined; with actual = 1 and forecast = 3 it reads 200%. Better scores for version one: (1) **coverage** - the share of forecasts where the actual fell inside the stated range; target is the stated level (for example about 8 in 10); (2) **median absolute error** in leads; (3) **bias** - share of forecasts that were too high versus too low (should be about half each; a sales tool that is too high 80% of the time is a legal and trust problem); (4) a comparison against a naive forecast ("same as last period"), which is the scaled-error idea.
- **Shrinkage in one line of code.** Blended rate = (default_rate x k + customer_successes) / (k + customer_trials). Example: default lead rate 3%, k = 100 visits' worth of trust in the default; customer has 4 leads from 50 AI visits (8% raw); blended = (3 + 4) / (100 + 50) = 4.7%. As trials grow, the customer's own rate takes over. Explainable to an owner as: "We start from the industry average and move toward your own numbers as we see more of them."
- **Calibration loop for a small team:** (1) snapshot every forecast shown (inputs, range, date, model version); (2) at 90 days, pull trackable AI leads (section 6) and score; (3) quarterly, re-estimate industry defaults from all customers' observed rates; (4) if coverage is below the stated level, widen ranges before touching the midpoint; (5) publish the scorecard on the methodology page, including the bad result; (6) version the model and keep a change log.
- **Do not backfit.** Tune defaults on older periods and score on later ones, never on the same data.
- **Free-audit forecasts cannot be scored** unless the prospect becomes a customer and connects data; say that the published track record covers connected customers only, and expect it to flatter the audit version (the Zillow on-market versus off-market gap is the analogy).
- **Selection effect:** customers who stay long enough to be scored are probably those doing better. Report how many forecasts were scored out of how many issued.

### Gaps
- No source found on how many observations are needed before a forecast track record for a small-count funnel is meaningful; the 90-day and quarterly cadences above are my judgment.
- Tetlock-style scoring (Brier scores) was not sourced.
- Attribution of an observed rise in leads to AI visibility (versus season, ads, or other marketing) is a causal question none of these methods solve; a holdout or before/after design was not researched.

---

## 8. What a first version should leave out to stay credible

### Takeaway
Leave out anything that cannot be measured or evidenced yet: revenue totals compounded over years, a single unqualified number, a stated accuracy percentage, untracked "dark" AI influence presented as fact, and any suggestion that the forecast is what Mirror's service will deliver.

### Cited Findings
- Claims need objective evidence in hand before publication, including implied claims. — [FTC, Advertising FAQ's](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business)
- An express level of support must actually be held. — [FTC Policy Statement Regarding Advertising Substantiation, 1984](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation)
- Accuracy claims about an AI product without evidence drew a final FTC order in 2025 (Workado). — [Frankfurt Kurnit](https://advertisinglaw.fkks.com/post/102l358/ftcs-ai-crackdown-continues-workado-ordered-to-drop-unsupported-accuracy-claims)
- Money conversions layered on a solid physical measurement are where consumer estimators go wrong (Sunroof's savings figure versus its solar-potential figure). — [MREA](https://midwestrenew.org/comparing-sunroof/)
- Benchmarks built on averages can differ wildly from typical results ("Typical +18%" versus "Average +164%"). — [HubSpot ROI calculator](https://www.hubspot.com/roi-calculator) (via search excerpts)
- Published AI-traffic benchmarks are vendor-sourced, conflict with each other, and one widely quoted conversion figure is from a single site. — [Seer Interactive](https://www.seerinteractive.com/insights/case-study-6-learnings-about-how-traffic-from-chatgpt-converts); [The Digital Bloom](https://thedigitalbloom.com/learn/gen-ai-website-traffic-share-february-2026/)
- AI's tracked share of traffic is small today (about 1% or less) though growing fast. — [upGrowth](https://upgrowth.in/ai-traffic-share-report-2026/); [Crispy Content](https://www.crispycontent.de/en/blog/ai-referral-traffic-chatgpt-growth-impact-b2b-brands-2026)

### Inferences
Leave out of version one:
1. **Multi-year or lifetime revenue totals.** Each extra multiplied assumption (retention, repeat purchase, growth of AI use) widens the range and inflates the headline. Show monthly leads and customers; show revenue only if the owner supplied their own average sale value, and label it as their number.
2. **A single number with no range**, and "up to" figures.
3. **Any accuracy percentage or "proven" language** until the backtest exists.
4. **Projected growth of AI usage.** Forecast at today's usage; mention growth in words only. The 623%-a-year figures are vendor numbers for a tiny base.
5. **Untracked influence stated as fact.** Keep "trackable" and "estimated total" separate; make the trackable one the headline.
6. **Per-engine breakdowns** (leads from Claude versus Grok). The data is too thin outside ChatGPT, which sends roughly two-thirds to four-fifths of AI referrals.
7. **"You are losing $X to competitors"** phrased as fact, and named-competitor revenue comparisons.
8. **Best-case customer stories next to the forecast**, unless typical results are also stated.
9. **Any link between the forecast and Mirror's price or a payback/ROI multiple** in the free audit. "Pay $200, gain $4,000" is the implied-promise claim that needs the strongest evidence, and Mirror has none yet.
10. **Decimal precision.** Round to whole leads and customers.
11. **Industries with no usable defaults.** Show "not enough data to estimate yet" rather than a generic number; refusing to guess is itself a credibility signal.
12. **Forecasts when measured visibility is based on very few scans.** Require a minimum number of buyer questions scanned before showing a number.

What to keep even in version one: the range, the labelled table of measured versus owner-supplied versus assumed inputs, sources and dates, "what is not counted", editable inputs, and a dated promise to publish how forecasts compared with results.

### Gaps
- No research was found that tests which omissions most affect a prospect's trust in a sales-tool forecast; the list above is reasoned from the legal standard and the example pages, not from a study.
- Whether to show revenue at all in the free audit is a business and legal judgment that should be made with counsel. **[LAWYER]**
