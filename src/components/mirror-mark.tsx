import Image from "next/image";

/**
 * The Mirror monogram, redrawn as vector.
 *
 * The supplied logo file is a raster lockup with the ivory sheet baked into
 * its background, so it cannot sit on the ink footer or scale to a favicon.
 * This reproduces the same idea in SVG: one M outline painted twice through
 * opposing clip paths: solid on the left half, hairline on the right, over a
 * bronze baseline, with a muted reflection beneath it. The mismatch between
 * the two halves is the product thesis: the reflection is never quite the
 * original.
 */

// Traced once and reused by both halves so the two paints stay in register.
const M_OUTLINE = "M0 0 H26 L60 58 L94 0 H120 V104 H104 V26 L66 92 H54 L16 26 V104 H0 Z";

export function MirrorMark({
  height = 44,
  reflection = true,
  className,
}: {
  height?: number;
  reflection?: boolean;
  className?: string;
}) {
  // The reflected copy needs vertical room; without it the box crops at the rule.
  const viewH = reflection ? 196 : 108;
  const uid = reflection ? "mk-mark-r" : "mk-mark-p";

  return (
    <svg
      viewBox={`0 0 120 ${viewH}`}
      height={height}
      width={(120 / viewH) * height}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <clipPath id={`${uid}-left`}>
          <rect x="0" y="0" width="60" height="104" />
        </clipPath>
        <clipPath id={`${uid}-right`}>
          <rect x="60" y="0" width="60" height="104" />
        </clipPath>
        {reflection && (
          <>
            {/* userSpaceOnUse so the fade is measured in viewBox units, below
                the rule, regardless of the rendered height. */}
            <linearGradient id={`${uid}-fade`} x1="0" y1="108" x2="0" y2="196" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={`${uid}-mask`}>
              <rect x="0" y="106" width="120" height="90" fill={`url(#${uid}-fade)`} />
            </mask>
          </>
        )}
      </defs>

      {/* upright mark */}
      <g>
        <path d={M_OUTLINE} fill="currentColor" clipPath={`url(#${uid}-left)`} />
        <path
          d={M_OUTLINE}
          stroke="currentColor"
          strokeWidth="2.5"
          clipPath={`url(#${uid}-right)`}
        />
      </g>

      {/* bronze baseline */}
      <rect x="0" y="105" width="120" height="1.4" fill="#a8763e" />

      {/* reflection: same two paints, flipped about the rule (y -> 212 - y) */}
      {reflection && (
        <g transform="matrix(1,0,0,-1,0,212)" mask={`url(#${uid}-mask)`}>
          <path d={M_OUTLINE} fill="currentColor" clipPath={`url(#${uid}-left)`} />
          <path
            d={M_OUTLINE}
            stroke="currentColor"
            strokeWidth="2.5"
            clipPath={`url(#${uid}-right)`}
          />
        </g>
      )}
    </svg>
  );
}

/**
 * The supplied lockup artwork, keyed off its ivory sheet so it composites on
 * any background. Two tones ship as separate files rather than a CSS filter
 * because the ivory cut keeps the bronze rule and reflection intact, which an
 * invert would destroy.
 *
 * `height` is the rendered height of the artwork. The word "Mirror" occupies
 * the middle 49% of that box; the rest is the monogram's reflection. So a 40px
 * lockup reads at roughly the same weight as 26px display type.
 *
 * The artwork also exists with the tagline baked in (mirror-lockup*.png), but
 * that crop sets the tagline at a fifth of the wordmark's size, which needs a
 * ~105px lockup to stay legible. On screen we use the tagline-free crop and
 * set the tagline as real text instead.
 */
const LOCKUP = {
  ink: "/mirror-wordmark.png",
  ivory: "/mirror-wordmark-ivory.png",
} as const;

const LOCKUP_RATIO = 1140 / 336;

export function MirrorLockup({
  height = 40,
  tone = "ink",
  tagline = false,
  priority = false,
}: {
  height?: number;
  tone?: "ink" | "ivory";
  tagline?: boolean;
  priority?: boolean;
}) {
  return (
    // The monogram's reflection runs to the bottom edge of the artwork, so the
    // tagline needs more clearance than a normal baseline gap would give.
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 9 }}>
      <Image
        src={LOCKUP[tone]}
        alt="Mirror"
        width={Math.round(height * LOCKUP_RATIO)}
        height={height}
        priority={priority}
      />
      {tagline && (
        <span
          style={{
            fontSize: 9.5,
            letterSpacing: "0.17em",
            textTransform: "uppercase",
            color: tone === "ink" ? "#78746c" : "rgba(247,245,240,0.6)",
          }}
        >
          See what AI tells your patients.{" "}
          <span style={{ color: "#a8763e" }}>Own your GEO.</span>
        </span>
      )}
    </span>
  );
}
