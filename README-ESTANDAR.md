# README standard

Keep the README in natural English, between 400 and 900 words. Move longer reference material into `docs/`.

The first screen contains, in order:

1. The project name and one sentence describing its benefit.
2. Real CI and license badges. Include a registry version only when published.
3. A real terminal recording generated with VHS from `docs/demo.tape` into `docs/demo.gif`, lasting 10 to 25 seconds. Record the CLI itself against a reproducible example, without mock output.
4. A quick start with two shell blocks: one installation command that works without a clone, then one usage command.

Follow with these sections in order:

- Features: three to six concrete benefits, one line each.
- Why: two or three sentences linking the need and its evidence.
- How it works: one paragraph or a small diagram.
- Usage: a table of commands or options.
- FAQ: three to five practical questions.
- Limitations: short, specific boundaries.
- Contributing: one line including the test command.
- License: link to the MIT license.

Use direct language without promotional filler, defensive text, or implementation details in the opening. Keep the GitHub installation command as the primary option until a registry release exists; installation from a clone is an alternative.

Run every documented command from a clean clone before release. Report unavailable remote checks explicitly. Have an independent reviewer follow the README before publication.
