"""
B10 — Coverage matrices.

YAML-driven per-project-type coverage requirements feeding the UEP
Phase-2 anti-omission gate (`services/uep/coverage_engine.py`).

Per task §3.2 each matrix lists every category that the pipeline must
account for; the engine produces a `CoverageReport` flagging
`pokryto / castecne / chybi / skip` per category.

PR1 ships `coverage_matrix_residential.yaml`. PR3 will add
`coverage_matrix_bridge.yaml` and `coverage_matrix_road.yaml`.
"""
