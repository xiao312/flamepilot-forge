# FlamePilot Forge

A public figure-review snapshot for CFD capability development.

[Open the study](https://xiao312.github.io/flamepilot-forge/)

The site contains the full registered target set from its declared source catalogue.
Its public target-catalog.json retains every target and its order, including targets without results.
Planned panels have no new numerical result. Available results are not automatically accepted.
Historical CFD checkpoints remain labelled; no current scheduler status is implied.

## Review

Use the feedback link beside a figure. It includes target, view, generation, and image/data hashes.
GitHub sign-in is required to post. A coordinator must review issues; there is no automatic agent dispatch.
Do not attach private PDFs, credentials, or server logs to public issues.

## Reproduce a plot

Use Node 24.14.1 and run npm ci --ignore-scripts. Then run:

```sh
node reproduce.mjs --data assets/liang-8a-series.json --recipe assets/liang-8a-case-1-recipe.json --output reproduced-case-1.svg --plan
```

Remove --plan to render. Input hashes are verified against site-manifest.json.
The raw points and plotting recipe are public. This repeats plotting, not the underlying solver calculation.
Recipe dispatch supports forge-plot-v1 (Vega) and forge-paper-style-v1 (measured paper layout).
The paper-style renderer consumes retained vector data and glyph paths; it does not extract source PDFs.
A figure revision can retain an older numerical run. Its evidence binding identifies that run explicitly.
Each numerical point retains available source/build/job provenance.
The source implementation remains in FlamePilot; this repository is a static publication snapshot.

## Rights

Selected paper excerpts retain their original rights and source attribution.
Cavalieri author content is CC BY 4.0; De Giorgi author content is CC BY 3.0.
Third-party experimental images retain separate rights. No blanket open license is granted.
The repository contains no complete source PDFs. See each figure and reference for attribution.
