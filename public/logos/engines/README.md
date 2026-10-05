# AI engine logos

The five engines Mirror scans. File names match the engine keys in code
(`chatgpt`, `claude`, `gemini`, `grok`, `perplexity`), so a component can
build the path straight from `check.engine`.

| File | Use it for |
| --- | --- |
| `<engine>.svg` | Default: brand color on light backgrounds. ChatGPT and Grok are black because that *is* their brand color. |
| `<engine>-white.svg` | Dark backgrounds (dark mode, dark report covers). |
| `<engine>-black.svg` | One-color print or anywhere colored logos would be noisy. |
| `<engine>-mono.svg` | Inline SVG only: fills with `currentColor`, so it follows the surrounding text color. Renders black inside an `<img>`. |
| `png/*.png` | 512×512 transparent PNGs for emails, PDFs, slides and docs, where SVG support is unreliable. |

Served from `/logos/engines/...`, e.g. `<img src="/logos/engines/claude.svg" width="20" height="20" alt="Claude">`.

Source: [LobeHub Icons](https://github.com/lobehub/lobe-icons) (MIT), fetched 2026-09-24.
The marks themselves are trademarks of OpenAI, Anthropic, Google, xAI and
Perplexity. Use them to label which engine said what, not to imply endorsement.
