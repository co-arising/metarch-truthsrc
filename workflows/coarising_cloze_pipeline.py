"""
Antigravity (AGY) `run_workflow` parallel delivery pipeline for co-arising 2.0 @cloze slots.

Usage from AGY:
  run_workflow(
    ScriptPath="/abs/path/to/metarch-truthsrc/workflows/coarising_cloze_pipeline.py",
    Description="Implement and blind-review all pending co-arising 2.0 @cloze slots",
    Args={"root": "/abs/path/to/project", "truthsrc_bin": "truthsrc", "targets": "typescript,scala"}
  )
"""
import json
import subprocess

root = args.get("root", WORKSPACES[0] if WORKSPACES else ".")
truthsrc_bin = args.get("truthsrc_bin", "truthsrc")
targets = args.get("targets", "typescript")


def run_cli(cmd_args, check=True):
    cmd = [truthsrc_bin, *cmd_args] if truthsrc_bin != "node" else cmd_args
    proc = subprocess.run(cmd, cwd=root, capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stdout}\n{proc.stderr}")
    return proc


phase("Discover Derived @cloze Tasks")
tasks_proc = run_cli(["tasks-v2", "--root", root, "--target", targets, "--format", "json"])
task_report = json.loads(tasks_proc.stdout)
actionable = task_report.get("parallelizable", [])
log(f"System {task_report['system']}/{task_report['context']}: {len(actionable)} actionable @cloze slot(s)")

if actionable:
    phase("Parallel @cloze Implementation")

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
        return (
            f"Implement co-arising 2.0 @cloze slot `{slot_id}` ({task['target']}).\n"
            f"Allowed files: {target_files}.\n"
            f"Edit ONLY inside `// @cloze:start({slot_id})` .. `// @cloze:end({slot_id})`.\n"
            f"NEVER touch generated-tests/ or generated-scaffold/.\n"
            f"Use exact fixed-point decimal helpers (no floating-point math).\n"
            f"Locked oracles count: {pack_meta['lockedOracleCount']}.\n"
            f"Run `truthsrc verify-v2 --root {root} --target {targets} --strict` before finishing."
        )

    worker_schema = {
        "type": "object",
        "properties": {
            "slotId": {"type": "string"},
            "editedFiles": {"type": "array", "items": {"type": "string"}},
            "summary": {"type": "string"},
        },
        "required": ["slotId", "editedFiles", "summary"],
    }

    worker_results = await parallel(
        actionable,
        lambda t: agent(
            build_worker_prompt(t),
            schema=worker_schema,
            role=f"Cloze Worker {t['slotId']}",
            workspace="inherit",
        ),
    )
    for wr in worker_results:
        log(f"Worker completed {wr['slotId']}: {wr['summary']}")

phase("Strict Stop-Hook Verification Gate")
verify_proc = run_cli([
    "verify-v2",
    "--root", root,
    "--target", targets,
    "--canonical", f"{root}/.truthsrc/canonical-v2.json",
    "--db", f"{root}/.truthsrc/knowledge.sqlite",
    "--strict",
])
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
            f"SHALL NOT violations, and out-of-bounds edits outside @cloze markers.\n"
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
