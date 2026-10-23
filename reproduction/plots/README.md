# Reusable comparison plots

This module renders selected numerical series with a shared publication style.
It keeps numerical evidence separate from visual interpolation. It does not run solvers or digitize papers.

`paper-style.mjs` provides an explicit paper-matched path. It does not change the shared renderer's defaults.
Use it when a target requires measured paper dimensions, typography, line widths, and marker sizes.

## Interface

`renderComparison(table, recipe)` returns SVG, the Vega-Lite specification, and a recipe record.
`table` uses `forge-series-v1`, a target ID, and named series with `origin`, `engine`, `case`, and `points`.
Each point has finite `x` and `y` values. Additional provenance fields remain in the input table.
Series require a unique ID, strictly increasing abscissae, and at least one point.

Recipes use `forge-plot-v1`, an ID, title, axis labels, optional axis domains, and a selected series list.
`smoothing` is `pchip`, `linear`, or `points`. PCHIP means piecewise cubic Hermite interpolation.
It preserves local shape, passes through samples, and does not extrapolate.
It is a visual guide, not a regression model or extra simulation data.
Regression requires a separate, reviewed model and fit record before this renderer can support it.
Missing series produce an explicit unavailable view; they never produce an invented curve.

Computed samples always have visible markers. Paper traces use dashed lines without dense markers.
Case colors stay fixed across overview views. Focused views use engine colors.
Errors, acceptance tests, and convergence decisions must use original numerical data.
Never calculate them from an interpolated SVG or sampled display curve.

## Dependencies and boundary

The renderer uses the locked Vega and Vega-Lite dependencies from Forge.
The static publication builder consumes its SVG and JSON outputs.
There is no network, filesystem mutation, scheduler, credential, or PDF dependency in this module.
Callers control output paths and public export rights. No secret belongs in a series record.

## Example and verification

```js
const output = await renderComparison(table, {
  schema: 'forge-plot-v1', id: 'case-1', title: 'Case 1',
  x: {label: 'Equivalence ratio'}, y: {label: 'Flame speed (cm/s)'},
  series: ['paper-1', 'cantera-1'], smoothing: 'pchip', colorBy: 'engine'
});
```

Run `node --test plots/*.test.mjs` from `apps/forge`.
Expected: interpolation preserves samples and local bounds; invalid inputs fail; raw points remain unchanged.
Replotting requires the original table and recipe. It does not reproduce the upstream solver run.

## Paper-matched figures

For new paper-replication targets, measure the original figure before plotting.
Freeze its figure dimensions, plot frame, axis limits, tick positions, font size,
line widths, and marker sizes in the target recipe. Record unavailable measurements explicitly.
Check reference-point coverage against the original crop, especially near annotations and overlapping symbols.
Retain discrete reference markers. Give every computed series a visible legend entry.
Use the shared-style renderer for separately requested overview views; it does not replace this fidelity check.

`renderPaperComparison(series, recipe)` returns SVG and an evidence receipt without filesystem writes.
The `forge-paper-style-v1` recipe specifies a canvas viewBox, pixel export size, plot frame,
axis domains and ticks, font size, grid width, legend position, and source PDF SHA-256/page.
All lengths use the recipe's coordinate unit, normally PDF points. Every series declares its own
color, line width, dash pattern, marker radius, and marker stroke width. There are no guessed style defaults.

Series contain ordered numerical points and their original provenance. Each requires an ID, label,
origin (`paper` or `computed`), and a mark (`line`, `points`, or `line-points`).
Paper markers remain discrete. Lines join supplied samples; no new reference points or fitted curves are created.
The receipt retains point counts and provenance. It does not infer numerical or physical uncertainty.

An optional `axisGlyphs` array preserves exact PDF glyph outlines. Each glyph contains only a numeric
SVG path and a six-number affine transform. This interface rejects scripts, external resources, and raw SVG markup.
Glyph files, PDF content, and extracted evidence stay in private trial storage. Callers own extraction and export rights.
An absent glyph array requires explicit axis-label positions and text in `labels`.
Legend text uses the declared font at the measured point size; font availability remains the caller's responsibility.

Minimal example:

```js
const {svg, receipt} = renderPaperComparison(series, {
  schema: 'forge-paper-style-v1', id: 'density',
  source: {sha256: pdfSha256, page: 3, method: 'PDF vector geometry'},
  canvas: {width: 645, height: 454, viewBox: [62, 588, 232, 163]},
  frame: [108.38, 597.59, 285.69, 703.98],
  x: {domain: [85, 300], ticks: [85, 100, 150, 200, 250, 300]},
  y: {domain: [0, 1400], ticks: [0, 200, 400, 600, 800, 1000, 1200, 1400]},
  font: {family: 'Times New Roman', size: 8.308829}, gridWidth: 0.415436,
  legend: {x: 179, y: 608, rowHeight: 11, sampleWidth: 11, textGap: 4},
  axisGlyphs: extractedGlyphs
});
```

Run `node --test plots/paper-style.test.mjs`. Expected: measured geometry is retained,
reference point coverage is unchanged, and missing provenance or unsafe glyph content fails.
`extractSelectedCircleMarkers(drawings, specification)` maps explicitly selected PDF circle drawings
to numerical and crop-pixel coordinates. It keeps duplicate path identities and does not apply raster masks.
Each drawing supplies `index`, `rect`, and four `commands` equal to `c`. The specification supplies
the frame, both axis domains, PDF source hash/page, pixel scale, and raster origin.
The caller must inspect the selected paths as circles. A four-curve square path alone does not prove marker identity.
This function consumes normalized vector records; it does not regenerate them from a PDF.
The private qualification uses PyMuPDF for PDF parsing and original glyph extraction.
Reproducing that extraction requires the exact private PDF, parser version, and extraction adapter.

Run `node --test plots/paper-style.test.mjs plots/vector-markers.test.mjs` for both interfaces.
This path has no new runtime dependency. It does not parse PDFs, execute solvers, or approve results.
