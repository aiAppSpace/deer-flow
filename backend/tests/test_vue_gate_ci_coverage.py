"""What the Vue README says CI runs has to be what CI runs.

`frontend-vue/README.md` now states which gates CI executes and which three run
only locally, with a reason for each.  A paragraph like that is worth nothing
on its own -- it is a rule written down with no machine enforcing it, which is
the exact failure this repo keeps finding (a compose service documented as
optional that started unconditionally; an nginx compression policy stated for
"Nginx" that one of three configs did not implement).

So both halves are pinned, and together they partition the set: every gate the
paragraph names as CI-run must appear in a workflow, and every gate it names as
local-only must appear in none.  Neither list can drift without the other
noticing, and adding a gate to CI without moving it out of the local-only
sentence fails just as loudly as the reverse.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from support.detectors.repo_root import resolve_repo_root

REPO_ROOT = resolve_repo_root(Path(__file__))
WORKFLOWS = REPO_ROOT / ".github/workflows"
README = REPO_ROOT / "frontend-vue/README.md"

# Stated by the README's "What CI actually runs" paragraph. Kept here rather
# than parsed out of the prose: a regex over a sentence would quietly match
# less as the sentence is edited, and this list is the thing under test.
CI_RUN = frozenset({"verify", "asset-budget", "audit", "container-smoke", "e2e-mock", "e2e-backend"})
LOCAL_ONLY = frozenset({"icon-parity", "standalone-sim", "e2e-parity"})


def _workflow_make_targets() -> set[str]:
    found: set[str] = set()
    for path in sorted(WORKFLOWS.glob("*.y*ml")):
        for match in re.finditer(r"run:\s*make\s+([a-z][a-z0-9-]*)", path.read_text(encoding="utf-8")):
            found.add(match.group(1))
    return found


def test_the_readme_paragraph_still_exists_and_names_both_lists() -> None:
    """Self-proving: without this, the two lists below could describe a
    paragraph that was deleted, and every assertion would still pass."""
    readme = README.read_text(encoding="utf-8")
    assert "What CI actually runs" in readme
    for target in CI_RUN | LOCAL_ONLY:
        assert f"`{target}`" in readme or f"make {target}" in readme, target
    assert not (CI_RUN & LOCAL_ONLY)


@pytest.mark.parametrize("target", sorted(CI_RUN))
def test_a_gate_the_readme_calls_ci_run_is_in_a_workflow(target: str) -> None:
    assert target in _workflow_make_targets(), f"the Vue README says CI runs `make {target}`, and no workflow does"


@pytest.mark.parametrize("target", sorted(LOCAL_ONLY))
def test_a_gate_the_readme_calls_local_only_is_in_no_workflow(target: str) -> None:
    assert target not in _workflow_make_targets(), f"`make {target}` now runs in CI, which is good -- move it out of the README's local-only sentence and into the CI list, and update this test"
