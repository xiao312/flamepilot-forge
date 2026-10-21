# Agent organization for CFD development

Status: proposed. This publication does not enable autonomous solver changes or dispatch jobs.

The useful pattern is bounded candidate search with independent evaluation.
A coordinator communicates with the researcher, records decisions, and integrates one development branch.
Two workers can test distinct physical or numerical hypotheses in isolated worktrees.
A critic identifies assumptions and proposes counter-tests. It does not decide that a scientific result has passed.

Start with a strong single-worker baseline. Compare the extra roles under the same model and compute budget.
Retain the arrangement only if it improves accepted results per unit cost.
This is an engineering proposal drawn from the research below, not an established result for CFD.

| Research foundation | What to adopt | Limit |
| --- | --- | --- |
| [AlphaEvolve](https://arxiv.org/abs/2506.13131) | Candidate lineage, diverse alternatives, and evaluation stages with increasing cost | Results depend on the supplied evaluator; the technical report does not establish CFD validation |
| [FunSearch](https://www.nature.com/articles/s41586-023-06924-6) | Executable candidate programs and a fixed evaluation procedure | Its small program searches are cheaper than turbulent combustion tests |
| [AlphaGeometry](https://www.nature.com/articles/s41586-023-06747-5) | Separate proposal from checking | Formal proof checking has stronger guarantees than experimental comparison |
| [AlphaDev](https://www.nature.com/articles/s41586-023-06004-9) | Correctness gates before performance optimization | Assembly sorting tasks have a narrow, well-defined correctness boundary |
| [DiscoRL](https://www.nature.com/articles/s41586-025-09761-x) | Test learned improvements beyond the discovery environments | Training a learning algorithm is a separate research investment |
| [AlphaProof](https://www.nature.com/articles/s41586-025-09833-y) | Preserve verified evidence throughout search and learning | Formal mathematics and substantial training do not directly transfer to CFD |
| [Agent collaboration study](https://www.nature.com/articles/s42256-026-01268-y) | Measure collaboration against a capable baseline | More agents can reduce performance; task and model capability matter |

## Apply the pattern to the ladder

Freeze a target's conditions, observable, source figure, numerical reference data, and acceptance scope before a candidate trial.
Keep development targets separate from held-out regression cases.
Record code commit, environment digest, mechanism, case inputs, and output hashes for every run.
Do not reward a candidate merely for making one plot look closer to a reference.

Advance candidates through property tests, chemistry/flamelet tests, table reconstruction, solver verification, and then full G2 comparisons.
Require conservation, stability, resolution, and sample-convergence evidence alongside figure agreement.
Use failed tests to distinguish hypotheses before allocating another expensive simulation.
Retain useful failed candidates and their evidence without merging all of them.

Use FlamePilot `fp_slurm` for every sustained compute submission.
The existing controller owns job identity, watching, and native continuation notifications.
Current integration guarantees must remain explicit: terminal notifications exist; complete observed-state transition delivery needs qualification.
The static site and GitHub Issues do not themselves submit jobs or wake a coordinator.

Human researchers choose evidence and review the exact result generation.
An image comment is a proposal; a pass requires stated conditions and criteria.
One coordinator serializes integration after checks, while candidate workers keep independent branches.
