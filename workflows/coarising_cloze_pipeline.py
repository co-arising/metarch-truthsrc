"""
Antigravity (AGY) `run_workflow` parallel delivery pipeline for co-arising 2.0 @cloze slots.

Uses isolated git worktrees (`workspace="share"` by default, configurable via
`bindings/*-testing.yaml` `parallelTdd.workspaceMode` or `Args.workspace_mode`) so parallel
TDD workers never collide on build artifacts (`target/`, `.truthsrc/scala-classes`) or
`.truthsrc/knowledge.sqlite` locks.

Usage from AGY:
  run_workflow(
    ScriptPath="/abs/path/to/metarch-truthsrc/workflows/coarising_cloze_pipeline.py",
    Description="Implement and blind-review all pending co-arising 2.0 @cloze slots",
    Args={"root": "/abs/path/to/project", "truthsrc_bin": "truthsrc", "targets": "typescript,scala"}
  )
"""
import json
import os
import re
import subprocess

root = args.get("root", WORKSPACES[0] if WORKSPACES else ".")
truthsrc_bin = args.get("truthsrc_bin", "truthsrc")
targets = args.get("targets", "typescript")


def load_canonical_testing():
    canonical_path = os.path.join(root, ".truthsrc/canonical-v2.json")
    if not os.path.exists(canonical_path):
        return {}
    with open(canonical_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("testing") or {}


testing_cfg = load_canonical_testing()
parallel_cfg = testing_cfg.get("parallelTdd") or {}
workspace_mode = args.get("workspace_mode", parallel_cfg.get("workspaceMode", "share"))
min_coverage = args.get("min_coverage", (testing_cfg.get("layers") or {}).get("domain", {}).get("minLineCoverage"))


def run_cli(cmd_args, check=True, cwd=None):
    cmd = [truthsrc_bin, *cmd_args] if truthsrc_bin != "node" else cmd_args
    proc = subprocess.run(cmd, cwd=cwd or root, capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stdout}\n{proc.stderr}")
    return proc


def merge_cloze_slot_from_worktree(slot_id, src_root, dst_root, rel_files):
    """Safely splice ONLY // @cloze:start(slot)..// @cloze:end(slot) blocks from isolated worker worktree."""
    pattern = re.compile(
        rf"(//\s*@cloze:start\({re.escape(slot_id)}\)\r?\n)([\s\S]*?)(\r?\n\s*//\s*@cloze:end\({re.escape(slot_id)}\))"
    )
    for rel in rel_files:
        src_path = os.path.join(src_root, rel)
        dst_path = os.path.join(dst_root, rel)
        if not os.path.exists(src_path) or not os.path.exists(dst_path):
            continue
        with open(src_path, "r", encoding="utf-8") as fh:
            src_text = fh.read()
        with open(dst_path, "r", encoding="utf-8") as fh:
            dst_text = fh.read()
        src_match = pattern.search(src_text)
        if not src_match:
            continue
        new_dst, count = pattern.subn(lambda m: m.group(1) + src_match.group(2) + m.group(3), dst_text, count=1)
        if count == 1 and new_dst != dst_text:
            with open(dst_path, "w", encoding="utf-8") as fh:
                fh.write(new_dst)


phase("Discover Derived @cloze Tasks")
tasks_proc = run_cli(["tasks-v2", "--root", root, "--target", targets, "--format", "json"])
task_report = json.loads(tasks_proc.stdout)
actionable = task_report.get("parallelizable", [])
log(
    f"System {task_report['system']}/{task_report['context']}: "
    f"{len(actionable)} actionable @cloze slot(s) (workspaceMode={workspace_mode})"
)

if actionable:
    phase("Parallel Isolated @cloze Implementation")

    def build_worker_prompt(task):
        slot_id = task["slotId"]
        pack_proc = run_cli([
            "context-pack-v2",
            "--in", f"{root}/.truthsrc/canonical-v2.json",
            "--db", f"{root}/.truthsrc/knowledge.sqlite",
            "--slot", slot_id,
            "--workspace", root,
        ])
        pack_meta = json.loads(pack_proc.stdout)
        target_files = ", ".join(f["file"] for f in task["targetFiles"])
        cov_hint = f" --min-coverage {min_coverage}" if min_coverage is not None else ""
        return (
            f"Implement co-arising 2.0 @cloze slot `{slot_id}` ({task['target']}) inside your isolated workspace.\n"
            f"Allowed files: {target_files}.\n"
            f"Edit ONLY inside `// @cloze:start({slot_id})` .. `// @cloze:end({slot_id})`.\n"
            f"NEVER touch generated-tests/ or generated-scaffold/.\n"
            f"Keep behavioral code 100% deterministic (no wall-clock Date.now/Instant.now or UUID.randomUUID; use injected params/ports).\n"
            f"Use exact fixed-point decimal helpers (no floating-point math).\n"
            f"Locked oracles count: {pack_meta['lockedOracleCount']}.\n"
            f"Run `truthsrc verify-v2 --root . --target {targets} --strict{cov_hint}` inside your workspace before finishing, "
            f"and return your workspaceRoot path along with the editedFiles."
        )

    worker_schema = {
        "type": "object",
        "properties": {
            "slotId": {"type": "string"},
            "workspaceRoot": {"type": "string"},
            "editedFiles": {"type": "array", "items": {"type": "string"}},
            "summary": {"type": "string"},
        },
        "required": ["slotId", "workspaceRoot", "editedFiles", "summary"],
    }

    worker_results = await parallel(
        actionable,
        lambda t: agent(
            build_worker_prompt(t),
            schema=worker_schema,
            role=f"Cloze Worker {t['slotId']}",
            workspace=workspace_mode,
        ),
    )
    for wr in worker_results:
        if workspace_mode != "inherit" and wr.get("workspaceRoot") and os.path.abspath(wr["workspaceRoot"]) != os.path.abspath(root):
            merge_cloze_slot_from_worktree(wr["slotId"], wr["workspaceRoot"], root, wr["editedFiles"])
        log(f"Worker completed {wr['slotId']} (merged from {workspace_mode}): {wr['summary']}")

phase("Strict Stop-Hook Verification Gate (Aggregated + Coverage + Testability)")
verify_cmd = [
    "verify-v2",
    "--root", root,
    "--target", targets,
    "--canonical", f"{root}/.truthsrc/canonical-v2.json",
    "--db", f"{root}/.truthsrc/knowledge.sqlite",
    "--strict",
]
if min_coverage is not None:
    verify_cmd.extend(["--min-coverage", str(min_coverage)])
run_cli(verify_cmd)
log("verify-v2 --strict PASSED")

phase("Parallel Independent Blind Review")
refresh_proc = run_cli(["tasks-v2", "--root", root, "--target", targets, "--format", "json"])
review_queue = json.loads(refresh_proc.stdout).get("reviewQueue", [])
log(f"{len(review_queue)} slot(s) queued for fresh-context blind review")

if review_queue:
    review_schema = {
        "type": "object",
        "properties": {
            "slotId": {"type": "string"},
            "verdict": {"type": "string", "enum": ["PASS", "FAIL"]},
            "notes": {"type": "string"},
        },
        "required": ["slotId", "verdict", "notes"],
    }

    def build_reviewer_prompt(task):
        slot_id = task["slotId"]
        files = ", ".join(f["file"] for f in task["targetFiles"])
        oracles = ", ".join(f["oracle"] for f in task["targetFiles"])
        return (
            f"Independent Blind Review for @cloze slot `{slot_id}` ({task['target']}).\n"
            f"Read the .ears spec, implementation files ({files}), and locked oracles ({oracles}).\n"
            f"Check for: witness hardcoding, floating-point math, off-by-one boundaries, "
            f"non-deterministic clock/random APIs, SHALL NOT violations, and out-of-bounds edits outside @cloze markers.\n"
            f"Return verdict PASS or FAIL with concise notes."
        )

    reviews = await parallel(
        review_queue,
        lambda t: agent(
            build_reviewer_prompt(t),
            schema=review_schema,
            role=f"Blind Reviewer {t['slotId']}",
            type_name="research",
        ),
    )
    for rev in reviews:
        run_cli([
            "tasks-v2",
            "--root", root,
            "--record-review",
            "--slot", rev["slotId"],
            "--verdict", rev["verdict"],
            "--reviewer", "agy-blind-reviewer",
            "--notes", rev["notes"],
        ])
        log(f"Blind Review [{rev['verdict']}] {rev['slotId']}: {rev['notes']}")
        if rev["verdict"] != "PASS":
            raise RuntimeError(f"Blind review rejected slot {rev['slotId']}: {rev['notes']}")

phase("Final Aggregated Gate (check-v2 --strict)")
final_proc = run_cli(["check-v2", "--root", root, "--target", targets, "--strict", "--format", "human"])
print(final_proc.stdout)
