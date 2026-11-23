"""What the Vue README says CI runs has to be what CI runs.

`frontend-vue/README.md` states which gates CI executes. A paragraph like that is worth nothing
on its own -- it is a rule written down with no machine enforcing it, which is
the exact failure this repo keeps finding (a compose service documented as
optional that started unconditionally; an nginx compression policy stated for
"Nginx" that one of three configs did not implement).

Every gate named in that paragraph must appear in a workflow. The native Linux
visual run and complete cross-app job dependencies are mandatory, including
the real session suite after anonymous auth. The local aggregate stays serial.
"""

from __future__ import annotations

import copy
import os
import re
import shlex
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml
from support.detectors.repo_root import resolve_repo_root

REPO_ROOT = resolve_repo_root(Path(__file__))
WORKFLOWS = REPO_ROOT / ".github/workflows"
PARITY_WORKFLOW = "frontend-vue-parity.yml"
README = REPO_ROOT / "frontend-vue/README.md"

# Stated by the README's "What CI actually runs" paragraph. Kept here rather
# than parsed out of the prose: a regex over a sentence would quietly match
# less as the sentence is edited, and this list is the thing under test.
CI_RUN = frozenset(
    {
        "verify",
        "asset-budget",
        "audit",
        "container-smoke",
        "e2e-mock",
        "e2e-backend",
        "e2e-external",
        "standalone-sim",
        "icon-parity",
        "e2e-parity-auth",
        "e2e-parity-ci",
        "e2e-parity-session",
        "e2e-visual",
    }
)


def _workflow_make_targets() -> set[str]:
    found: set[str] = set()
    for path in sorted(WORKFLOWS.glob("*.y*ml")):
        for match in re.finditer(r"run:\s*make\s+([a-z][a-z0-9-]*)", path.read_text(encoding="utf-8")):
            found.add(match.group(1))
    return found


def test_the_readme_paragraph_still_exists_and_names_every_ci_gate() -> None:
    """Self-proving: without this, the two lists below could describe a
    paragraph that was deleted, and every assertion would still pass."""
    readme = README.read_text(encoding="utf-8")
    assert "What CI actually runs" in readme
    for target in CI_RUN:
        assert f"`{target}`" in readme or f"make {target}" in readme, target


@pytest.mark.parametrize("target", sorted(CI_RUN))
def test_a_gate_the_readme_calls_ci_run_is_in_a_workflow(target: str) -> None:
    assert target in _workflow_make_targets(), f"the Vue README says CI runs `make {target}`, and no workflow does"


def test_cross_app_ci_gate_includes_real_session_in_order() -> None:
    makefile = (REPO_ROOT / "frontend-vue/Makefile").read_text(encoding="utf-8")
    recipe = re.search(r"^e2e-cross-app:.*\n((?:\t.*\n)+)", makefile, re.MULTILINE)
    assert recipe is not None
    targets = re.findall(r"\$\(MAKE\).*?\b(e2e-parity(?:-auth|-session)?)\b", recipe.group(1))
    assert targets == ["e2e-parity", "e2e-parity-auth", "e2e-parity-session"]


@pytest.mark.parametrize("event", ["push", "pull_request"])
def test_react_dependency_patch_changes_trigger_vue_parity_verification(
    event: str,
) -> None:
    # BaseLoader retains GitHub's "on" key instead of treating it as YAML 1.1 true.
    workflow = yaml.load(
        (WORKFLOWS / "frontend-vue-verify.yml").read_text(encoding="utf-8"),
        Loader=yaml.BaseLoader,
    )
    assert "frontend/patches/**" in workflow["on"][event]["paths"]


def _upstream_watched_paths() -> list[str]:
    source = (REPO_ROOT / "frontend-vue/scripts/upstream-drift.mjs").read_text(encoding="utf-8")
    declaration = re.search(r"export const WATCHED = \[(.*?)\];", source, re.DOTALL)
    assert declaration is not None, "upstream review scope must be inspectable"
    paths = re.findall(r'"([^"\n]+)"', declaration.group(1))
    assert paths
    return paths


@pytest.mark.parametrize("event", ["push", "pull_request"])
@pytest.mark.parametrize("watched", _upstream_watched_paths())
def test_every_upstream_review_path_triggers_vue_verification(event: str, watched: str) -> None:
    workflow = yaml.load(
        (WORKFLOWS / "frontend-vue-verify.yml").read_text(encoding="utf-8"),
        Loader=yaml.BaseLoader,
    )
    required = f"{watched}/**" if (REPO_ROOT / watched).is_dir() else watched
    assert required in workflow["on"][event]["paths"], f"{event} does not cover the complete reviewed source boundary {required}"


def test_full_parity_matrix_requires_all_groups_and_both_auth_suites():
    product, auth, aggregate = "parity-product", "parity-auth", "parity"
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    jobs = workflow["jobs"]
    plan = jobs["parity-plan"]
    assert any("node frontend-vue/scripts/parity-ci.mjs --matrix" in step.get("run", "") for step in plan["steps"])
    assert plan["outputs"]["groups"] == "${{ steps.groups.outputs.groups }}"
    selected = jobs[product]
    assert selected["needs"] == "parity-plan"
    assert selected["strategy"]["matrix"] == "${{ fromJSON(needs.parity-plan.outputs.groups) }}"
    assert selected["strategy"]["fail-fast"] == "false"
    assert selected["timeout-minutes"] == "180"
    assert any(step.get("run") == 'make e2e-parity-ci GROUP="${{ matrix.group }}"' for step in selected["steps"])
    uploads = [step for step in selected["steps"] if step.get("uses", "").startswith("actions/upload-artifact@")]
    assert len(uploads) == 1
    assert uploads[0]["if"] == "always()"
    assert "${{ matrix.group }}" in uploads[0]["with"]["name"]
    assert "frontend-vue/test-results/**" in uploads[0]["with"]["path"]
    runs = [step.get("run", "") for step in jobs[auth]["steps"]]
    assert "make e2e-parity-auth" in runs
    assert "make e2e-parity-session" in runs
    assert runs.index("make e2e-parity-auth") < runs.index("make e2e-parity-session")
    final = jobs[aggregate]
    assert set(final["needs"]) == {"parity-plan", product, auth}
    assert "always()" in final["if"]
    commands = "\n".join(step.get("run", "") for step in final["steps"])
    for dependency in final["needs"]:
        assert f'test "${{{{ needs.{dependency}.result }}}}" = success' in commands


def test_diagnostic_dispatch_never_publishes_or_cancels_the_formal_aggregate():
    formal = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    diagnostic = yaml.load((WORKFLOWS / "frontend-vue-parity-diagnostic.yml").read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    assert set(diagnostic["on"]) == {"workflow_dispatch"}
    assert diagnostic["on"]["workflow_dispatch"]["inputs"]["parity_only"]["required"] == "true"
    assert set(diagnostic["jobs"]) == {"parity-diagnostic"}
    assert diagnostic["jobs"]["parity-diagnostic"].get("name", "parity-diagnostic") == "parity-diagnostic"
    _assert_concurrency_isolation(formal, diagnostic)
    assert formal["on"]["workflow_dispatch"] in (None, "", {})
    assert formal["jobs"]["parity"]["if"] == "always()"
    for name in ("parity-plan", "parity-product", "parity-auth"):
        assert "if" not in formal["jobs"][name]
    assert "PARITY_ONLY" not in str(formal)
    assert "PARITY_ACCEPT" not in str(formal)
    first = next(step for step in diagnostic["jobs"]["parity-diagnostic"]["steps"] if step.get("id") == "diagnostic-scope")
    assert first["run"] == "node -e 'if (!process.env.PARITY_ONLY?.trim()) process.exit(1)'"
    assert first["env"]["PARITY_ONLY"] == "${{ inputs.parity_only }}"
    assert "if" not in first
    assert first.get("continue-on-error", "false") == "false"


@pytest.mark.skipif(shutil.which("bash") is None, reason="GitHub's Ubuntu shell requires bash")
@pytest.mark.parametrize("value, accepted", [("", False), ("   ", False), ("\t\n", False), ("\ufeff", False), ("branch-thread", True), ("$(exit 7)", True)])
def test_diagnostic_input_is_data_and_empty_scope_fails(value, accepted):
    workflow = yaml.load((WORKFLOWS / "frontend-vue-parity-diagnostic.yml").read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    command = next(step["run"] for step in workflow["jobs"]["parity-diagnostic"]["steps"] if step.get("id") == "diagnostic-scope")
    result = subprocess.run(["bash", "-e", "-c", command], env={**os.environ, "PARITY_ONLY": value}, capture_output=True, text=True)
    assert (result.returncode == 0) is accepted


@pytest.mark.skipif(shutil.which("bash") is None, reason="GitHub's Ubuntu shell requires bash")
@pytest.mark.parametrize("result", ["failure", "cancelled", "skipped"])
def test_aggregate_shell_rejects_each_non_success_dependency(result: str) -> None:
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    job = workflow["jobs"]["parity"]
    source = "\n".join(step.get("run", "") for step in job["steps"])
    for failed in [None, *job["needs"]]:
        script = source
        for dependency in job["needs"]:
            state = result if dependency == failed else "success"
            script = script.replace(f"${{{{ needs.{dependency}.result }}}}", state)
        child = subprocess.run(["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script], capture_output=True, text=True)
        assert (child.returncode == 0) is (failed is None), (failed, result, child.stdout, child.stderr)


@pytest.mark.skipif(shutil.which("bash") is None or os.name == "nt", reason="GitHub's Ubuntu shell and executable fixture")
@pytest.mark.parametrize("pipeline", [False, True])
def test_matrix_planner_failure_is_not_hidden_by_echo(tmp_path: Path, pipeline: bool) -> None:
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    step = next(step for step in workflow["jobs"]["parity-plan"]["steps"] if step.get("id") == "groups")
    fake_node = tmp_path / "node"
    fake_node.write_text("#!/bin/sh\necho partial-invalid-matrix\nexit 13\n", encoding="utf-8")
    fake_node.chmod(0o755)
    output = tmp_path / "job-output"
    environment = {**os.environ, "PATH": str(tmp_path) + os.pathsep + os.environ["PATH"], "GITHUB_OUTPUT": str(output)}
    assert workflow["defaults"]["run"]["shell"] == "bash"
    command = step["run"]
    if pipeline:
        command = command.replace("--matrix)", "--matrix | cat)")
        assert command != step["run"]
    child = subprocess.run(["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", command], env=environment, capture_output=True, text=True)
    assert child.returncode == 13
    assert not output.exists(), "Failed planning must not publish a matrix as a successful job output"


def _comparison_owners(workflows: dict) -> dict[str, list[tuple[str, str]]]:
    targets = ("e2e-parity-ci", "e2e-parity-auth", "e2e-parity-session")
    aliases = {"e2e-parity": (targets[0],), "e2e-cross-app": targets}
    owners = {target: [] for target in targets}
    for filename, workflow in workflows.items():
        for job_name, job in workflow.get("jobs", {}).items():
            for step in job.get("steps", []):
                commands = step.get("run", "").replace("\\\n", "")
                for line in commands.splitlines():
                    lexer = shlex.shlex(line, posix=True, punctuation_chars=";&|()\n")
                    lexer.whitespace = " \t\r"
                    lexer.whitespace_split = True
                    command = []
                    # Keep invocation multiplicity, including two calls in one job.
                    for token in [*lexer, ";"]:
                        if token and all(char in ";&|()\n" for char in token):
                            positions = [i for i, word in enumerate(command) if Path(word).name == "make"]
                            if positions:
                                index = positions[0]
                                prefix = command[:index]
                                if all(word in {"then", "do", "!", "command", "env"} or re.match(r"^[A-Za-z_][A-Za-z_0-9]*=", word) for word in prefix):
                                    for argument in command[index + 1 :]:
                                        for target in aliases.get(argument, (argument,)):
                                            if target in owners:
                                                owners[target].append((filename, job_name))
                            command = []
                        else:
                            command.append(token)
    return owners


def test_formal_comparison_has_one_workflow_owner_without_duplicate_jobs():
    workflows = {p.name: yaml.load(p.read_text(encoding="utf-8"), Loader=yaml.BaseLoader) for p in WORKFLOWS.glob("*.y*ml")}
    owners = _comparison_owners(workflows)
    assert owners == {
        "e2e-parity-ci": [(PARITY_WORKFLOW, "parity-product")],
        "e2e-parity-auth": [(PARITY_WORKFLOW, "parity-auth")],
        "e2e-parity-session": [(PARITY_WORKFLOW, "parity-auth")],
    }


@pytest.mark.parametrize("target", ["e2e-parity-ci", "e2e-parity-auth", "e2e-parity-session"])
def test_owner_detector_preserves_duplicates_and_does_not_count_comments(target):
    example = {"jobs": {"formal": {"steps": [{"run": f"make {target}"}]}, "comment": {"steps": [{"run": f"# make {target}\necho diagnostic"}]}}}
    assert _comparison_owners({"one.yml": example, "two.yml": example})[target] == [("one.yml", "formal"), ("two.yml", "formal")]


@pytest.mark.parametrize("event", ["push", "pull_request"])
@pytest.mark.parametrize("watched", _upstream_watched_paths())
def test_sole_formal_owner_covers_every_upstream_source(event, watched):
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    selection = workflow["on"][event]
    _assert_full_event_scope(workflow)
    paths = selection["paths"]
    assert not any(path.startswith("!") for path in paths), "A later negative filter must not carve holes in reviewed sources"
    # Exact files or complete ancestor /** patterns cover the whole subtree.
    assert _covers_source_path(paths, watched, is_file=(REPO_ROOT / watched).is_file()), (event, watched)


def test_formal_owner_keeps_react_required_and_does_not_override_it():
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    assert workflow["env"]["PARITY_REQUIRE_REACT"] == "1"
    for name in ("parity-product", "parity-auth"):
        job = workflow["jobs"][name]
        assert job.get("env", {}).get("PARITY_REQUIRE_REACT", "1") == "1"
        for step in job["steps"]:
            assert step.get("env", {}).get("PARITY_REQUIRE_REACT", "1") == "1"


@pytest.mark.parametrize(
    "command, product, auth, session",
    [
        ("make e2e-parity-ci\nmake e2e-parity-ci", 2, 0, 0),
        ("make e2e-parity-ci && make e2e-parity-ci", 2, 0, 0),
        ("make -C frontend-vue e2e-cross-app", 1, 1, 1),
        ("make e2e-parity", 1, 0, 0),
        ("echo preparing # note\nmake e2e-parity", 1, 0, 0),
        ("# make e2e-parity-ci\necho 'make e2e-parity-ci'", 0, 0, 0),
    ],
)
def test_comparison_detector_counts_invocations_and_whole_suite_aliases(command, product, auth, session):
    owners = _comparison_owners({"fixture.yml": {"jobs": {"check": {"steps": [{"run": command}]}}}})
    assert [len(rows) for rows in owners.values()] == [product, auth, session]


@pytest.mark.parametrize("event", ["push", "pull_request"])
@pytest.mark.parametrize(
    "path",
    [
        "frontend-vue/**",
        "frontend/**",
        "scripts/pnpm.py",
        "scripts/serve.sh",
        "Makefile",
        "backend/scripts/run_replay_gateway.py",
        ".github/workflows/frontend-vue-verify.yml",
        ".github/workflows/frontend-vue-parity.yml",
        ".github/workflows/frontend-vue-parity-diagnostic.yml",
    ],
)
def test_formal_owner_observes_its_runtime_and_workflow_inputs(event, path):
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    assert path in workflow["on"][event]["paths"]


def _assert_unconditional_formal_steps(workflow):
    forbidden = {"PARITY_ONLY", "PARITY_ACCEPT", "PARITY_ACCEPT_GROW", "E2E_ALLOW_CONCURRENT"}
    required = {
        "parity-plan": "groups",
        "parity-product": 'make e2e-parity-ci GROUP="${{ matrix.group }}"',
        "parity-auth": "make e2e-parity-auth",
        "parity": "Require the complete comparison",
    }
    assert not forbidden.intersection(workflow.get("env", {}))
    assert workflow.get("defaults", {}).get("run", {}).get("shell") == "bash"
    for name, marker in required.items():
        job = workflow["jobs"][name]
        assert job.get("continue-on-error", "false") == "false"
        assert job.get("if") == ("always()" if name == "parity" else None)
        assert not forbidden.intersection(job.get("env", {}))
        assert job.get("defaults", {}).get("run", {}).get("shell", "bash") == "bash"
        selected = [step for step in job["steps"] if step.get("id") == marker or step.get("run") == marker or step.get("name") == marker]
        expected_count = 1
        if name == "parity-auth":
            selected += [step for step in job["steps"] if step.get("run") == "make e2e-parity-session"]
            expected_count += 1
        if name in {"parity-product", "parity-auth"}:
            selected += [step for step in job["steps"] if step.get("run") == "python3 scripts/pnpm.py --dir frontend install --frozen-lockfile --strict-peer-dependencies"]
            expected_count += 1
        assert len(selected) == expected_count
        for step in selected:
            assert "if" not in step
            assert step.get("continue-on-error", "false") == "false"
            assert step.get("shell", "bash") == "bash"
            assert not forbidden.intersection(step.get("env", {}))


def test_formal_steps_cannot_skip_or_accept_away_failures():
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    _assert_unconditional_formal_steps(workflow)


@pytest.mark.parametrize("job", ["parity-plan", "parity-product", "parity-auth", "parity"])
@pytest.mark.parametrize("key, value", [("if", "false"), ("continue-on-error", "true"), ("defaults", {"run": {"shell": "bash {0}"}})])
def test_formal_job_failure_guard_rejects_skipped_or_swallowed_work(job, key, value):
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    mutated = copy.deepcopy(workflow)
    mutated["jobs"][job][key] = value
    with pytest.raises(AssertionError):
        _assert_unconditional_formal_steps(mutated)


@pytest.mark.parametrize("flag", ["PARITY_ONLY", "PARITY_ACCEPT", "PARITY_ACCEPT_GROW", "E2E_ALLOW_CONCURRENT"])
@pytest.mark.parametrize("level", ["workflow", "job", "step"])
def test_formal_acceptance_switches_cannot_enter_any_environment_level(flag, level):
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    mutated = copy.deepcopy(workflow)
    auth = mutated["jobs"]["parity-auth"]
    target = mutated if level == "workflow" else auth if level == "job" else next(step for step in auth["steps"] if step.get("run") == "make e2e-parity-auth")
    target.setdefault("env", {})[flag] = "1"
    with pytest.raises(AssertionError):
        _assert_unconditional_formal_steps(mutated)


def test_formal_migration_preserves_strict_react_install_and_attempt_archives():
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    for name in ("parity-product", "parity-auth"):
        job = workflow["jobs"][name]
        assert any(step.get("run") == "python3 scripts/pnpm.py --dir frontend install --frozen-lockfile --strict-peer-dependencies" for step in job["steps"])
        uploads = [step for step in job["steps"] if step.get("uses", "").startswith("actions/upload-artifact@")]
        assert len(uploads) == 1
        upload = uploads[0]
        assert upload["if"] == ("always()" if name == "parity-product" else "failure()")
        assert "${{ github.run_attempt }}" in upload["with"]["name"]
        assert upload["with"].get("overwrite", "false") == "false"
        assert upload["with"]["retention-days"] == "14"
        for path in ("frontend-vue/test-results/**", "frontend-vue/playwright-report/**"):
            assert path in upload["with"]["path"]


def test_icons_remain_in_the_formal_ledger_job():
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    icons = [step for step in workflow["jobs"]["parity-product"]["steps"] if step.get("run") == "make icon-parity"]
    assert len(icons) == 1
    assert icons[0]["if"] == "matrix.group == 'ledger'"
    assert icons[0].get("continue-on-error", "false") == "false"


@pytest.mark.parametrize(
    "job, command",
    [
        ("parity-product", 'make e2e-parity-ci GROUP="${{ matrix.group }}"'),
        ("parity-auth", "make e2e-parity-auth"),
        ("parity-auth", "make e2e-parity-session"),
        ("parity-product", "python3 scripts/pnpm.py --dir frontend install --frozen-lockfile --strict-peer-dependencies"),
        ("parity-auth", "python3 scripts/pnpm.py --dir frontend install --frozen-lockfile --strict-peer-dependencies"),
    ],
)
@pytest.mark.parametrize("key, value", [("if", "false"), ("continue-on-error", "true"), ("shell", "bash {0}")])
def test_critical_step_guard_rejects_skipping_and_swallowed_failure(job, command, key, value):
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    mutated = copy.deepcopy(workflow)
    step = next(step for step in mutated["jobs"][job]["steps"] if step.get("run") == command)
    step[key] = value
    with pytest.raises(AssertionError):
        _assert_unconditional_formal_steps(mutated)


def _assert_full_event_scope(workflow):
    assert set(workflow["on"]) == {"push", "pull_request", "workflow_dispatch"}
    for event in ("push", "pull_request"):
        selection = workflow["on"][event]
        assert set(selection) == {"paths"}, "Formal events must not acquire ref/type exclusions"
        assert selection["paths"] and not any(path.startswith("!") for path in selection["paths"])


def _covers_source_path(patterns, watched, *, is_file):
    return (is_file and watched in patterns) or any(pattern.endswith("/**") and (watched == pattern[:-3] or watched.startswith(pattern[:-3] + "/")) for pattern in patterns)


def _assert_concurrency_isolation(formal, diagnostic):
    formal_template = "fe-vue-parity-${{ github.event.pull_request.number || github.ref }}"
    diagnostic_template = "fe-vue-parity-diagnostic-${{ github.ref }}"
    assert formal["concurrency"]["group"] == formal_template
    assert diagnostic["concurrency"]["group"] == diagnostic_template
    # Evaluate only these exact approved templates, not general GH expressions.
    for ref, number in [("refs/heads/main", None), ("refs/heads/diagnostic-main", None), ("refs/pull/42/merge", 42)]:
        formal_group = formal_template.replace("${{ github.event.pull_request.number || github.ref }}", str(number or ref))
        diagnostic_group = diagnostic_template.replace("${{ github.ref }}", ref)
        assert formal_group.lower() != diagnostic_group.lower()


@pytest.mark.parametrize(
    "event,key,value",
    [
        ("push", "tags", ["v*"]),
        ("push", "tags-ignore", ["*"]),
        ("push", "branches", ["main"]),
        ("push", "branches-ignore", ["main"]),
        ("pull_request", "types", ["closed"]),
        ("pull_request", "paths-ignore", ["backend/**"]),
    ],
)
def test_formal_event_guard_rejects_ref_and_activity_shrinkage(event, key, value):
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    workflow["on"][event][key] = value
    with pytest.raises(AssertionError):
        _assert_full_event_scope(workflow)


@pytest.mark.parametrize("event", ["push", "pull_request"])
def test_formal_event_guard_rejects_a_missing_event(event):
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    del workflow["on"][event]
    with pytest.raises(AssertionError):
        _assert_full_event_scope(workflow)


@pytest.mark.parametrize(
    "patterns, watched, is_file, expected",
    [
        (["backend/app"], "backend/app", False, False),
        (["backend/app/**"], "backend/app", False, True),
        (["backend/**"], "backend/app", False, True),
        (["backend/application/**"], "backend/app", False, False),
        (["scripts/pnpm.py"], "scripts/pnpm.py", True, True),
        (["backend/**"], "backend/scripts/run_replay_gateway.py", True, True),
        (["backend/app/**"], "backend/scripts/run_replay_gateway.py", True, False),
    ],
)
def test_source_boundary_guard_distinguishes_complete_subtrees_from_bare_directories(patterns, watched, is_file, expected):
    assert _covers_source_path(patterns, watched, is_file=is_file) is expected


def test_concurrency_guard_rejects_different_expressions_with_the_same_expanded_group():
    formal = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    diagnostic = yaml.load((WORKFLOWS / "frontend-vue-parity-diagnostic.yml").read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    formal["concurrency"]["group"] = "fe-vue-parity-diagnostic-${{ github.event.pull_request.number || github.ref }}"
    assert formal["concurrency"]["group"] != diagnostic["concurrency"]["group"]
    with pytest.raises(AssertionError):
        _assert_concurrency_isolation(formal, diagnostic)


def test_formal_failure_guard_requires_explicit_pipefail_shell():
    workflow = yaml.load((WORKFLOWS / PARITY_WORKFLOW).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    del workflow["defaults"]["run"]["shell"]
    with pytest.raises(AssertionError):
        _assert_unconditional_formal_steps(workflow)


def test_diagnostic_failure_archive_keeps_both_reports_and_attempts():
    workflow = yaml.load((WORKFLOWS / "frontend-vue-parity-diagnostic.yml").read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    uploads = [step for step in workflow["jobs"]["parity-diagnostic"]["steps"] if step.get("uses", "").startswith("actions/upload-artifact@")]
    assert len(uploads) == 1
    upload = uploads[0]
    assert upload["if"] == "always()"
    assert upload["with"]["retention-days"] == "14"
    assert "${{ github.run_attempt }}" in upload["with"]["name"]
    assert upload["with"].get("overwrite", "false") == "false"
    for path in ("frontend-vue/test-results/**", "frontend-vue/playwright-report/**"):
        assert path in upload["with"]["path"]
