# Reusable comparison plots

This module renders selected numerical series with a shared publication style.
It keeps numerical evidence separate from visual interpolation. It does not run solvers or digitize papers.

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

Run `node --test plots/*.test.mjs` from `extension/forge`.
Expected: interpolation preserves samples and local bounds; invalid inputs fail; raw points remain unchanged.
Replotting requires the original table and recipe. It does not reproduce the upstream solver run.
