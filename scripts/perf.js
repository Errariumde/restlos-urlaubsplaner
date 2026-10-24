// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The performance gate: counts the instructions of every scenario in tests/perf/scenarios.ts with Cachegrind
// (V8 --predictable, no garbage collection) at 8× and 16× its base size, and fails on super-linear growth, on a
// count more than 5 % over tests/perf/baseline.json, on a scenario list or baseline whose names don't match
// (scripts/perf-verdict.ts), and on a run that collected garbage. Part of npm run check.
// Usage: npm run perf                            the gate
//        npm run perf -- --update                writes tests/perf/baseline.json (lowering or raising a value
//                                                needs the maintainer's approval); refuses when growth fails
//        npm run perf -- --largest-file <path>   writes the worst crafted plan file within the limits (no Valgrind)
/* global console, process */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { earlyEasterRangesOffWeekday, entriesPlan, fillToLimits } from "../tests/engine/file/shapes.ts";
import { SCENARIOS } from "../tests/perf/scenarios.ts";
import { BUDGET_TOLERANCE, GROWTH_LIMIT, SIZES, checkScenarios, verdict } from "./perf-verdict.ts";

const ROOT = join(import.meta.dirname, "..");
const BASELINE = "tests/perf/baseline.json";
const VALGRIND = ["--tool=cachegrind", "--cache-sim=no", "--cachegrind-out-file=/dev/null", "--vgdb=no"];
// V8 settings under which a count depends only on the code and its input (issue 0020):
// - --predictable: single-threaded, with fixed seeds.
// - --liftoff-only: Node strips the TypeScript types with WebAssembly; V8 would optimize that code at moments
//   that depend on timing, which moved the startup count by up to 38 M instructions.
// - --no-incremental-marking: no collection started by a timed task.
// - a young generation of 1 GB: no collection at all. When a collection runs depends on how much the startup
//   allocated, which depends on the length of the checkout's path; it moved the counts by up to 7.5 %.
// - --trace-gc: V8 reports each collection on stdout, the child prints nothing else, and the gate fails a run
//   that reported one (tests/scripts/perf-trace-gc.test.ts pins that the report goes to stdout).
const CHILD = [
  "--predictable",
  "--liftoff-only",
  "--no-incremental-marking",
  "--min-semi-space-size=1024",
  "--max-semi-space-size=1024",
  "--trace-gc",
  "--import",
  "./scripts/ts-hooks.js",
  "scripts/perf-run.js",
];
const USAGE = "Usage: npm run perf [-- --update | -- --largest-file <path>]";

const args = process.argv.slice(2);

// 0. The largest file, for the manual timing at a release (.claude/skills/release/SKILL.md): no Valgrind needed.
if (args[0] === "--largest-file") {
  const path = args[1];
  if (path === undefined || args.length > 2) {
    console.error(USAGE);
    process.exit(1);
  }
  const text = entriesPlan(fillToLimits(earlyEasterRangesOffWeekday));
  writeFileSync(path, text);
  console.log(`perf: wrote ${path} (${String(text.length)} bytes)`);
  process.exit(0);
}
const update = args[0] === "--update";
if (args.length > (update ? 1 : 0)) {
  console.error(USAGE);
  process.exit(1);
}

// 1. Without Valgrind (outside the dev shell, or not on Linux) the gate is skipped locally; in CI (`CI` set) it
//    fails, so that CI never passes without having run it.
const version = spawnSync("valgrind", ["--version"], { encoding: "utf8" });
if (version.error !== undefined) {
  if (process.env.CI) {
    console.log("FAIL perf: Valgrind not found, and CI must run the gate (install Valgrind on the runner)");
    process.exit(1);
  }
  console.log("perf: skipped, Valgrind not found (the dev shell has it on Linux; CI runs the gate)");
  process.exit(0);
}
const valgrind = version.stdout.split("\n")[0].trim();

const millions = (count) => `${(count / 1e6).toFixed(1)} M`;
const percent = (change) => {
  const text = (change * 100).toFixed(1);
  return `${text.startsWith("-") ? "" : "+"}${text} %`;
};

/**
 * Runs perf-run.js with `job.args` under Cachegrind: resolves to its instruction count, to its stderr, or to
 * V8's report of a garbage collection on its stdout (`collected`).
 */
function count(job) {
  return new Promise((resolve) => {
    const child = spawn("valgrind", [...VALGRIND, process.execPath, ...CHILD, ...job.args], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ job, stderr: `${stderr}${error.message}\n` });
    });
    child.on("close", (status) => {
      const match = /I\s+refs:\s+([\d,]+)/.exec(stderr);
      if (status !== 0 || match === null) resolve({ job, stderr });
      else if (stdout.trim() !== "") resolve({ job, collected: stdout });
      else resolve({ job, count: Number(match[1].replaceAll(",", "")) });
    });
  });
}

/** Runs `jobs` with at most `parallel` at a time; the results keep the order of `jobs`. */
async function countAll(jobs, parallel) {
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await count(jobs[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, jobs.length) }, worker));
  return results;
}

/** The baseline, undefined without the file; throws when the file is not one. */
function readBaseline() {
  const path = join(ROOT, BASELINE);
  if (!existsSync(path)) return undefined;
  const baseline = JSON.parse(readFileSync(path, "utf8"));
  const valid =
    typeof baseline?.node === "string" &&
    typeof baseline.valgrind === "string" &&
    typeof baseline.work === "object" &&
    baseline.work !== null &&
    Object.values(baseline.work).every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every((n) => typeof n === "number" && n > 0));
  if (!valid) throw new Error("expected { node, valgrind, work: { <scenario>: [<count at 8×>, <count at 16×>] } }");
  return baseline;
}

/** The sentence for a finding of the verdict. */
function sentence(finding) {
  switch (finding.kind) {
    case "growth":
      return `FAIL ${finding.scenario}: twice the input costs ${finding.growth.toFixed(2)}× the work (limit ${String(GROWTH_LIMIT)}×), so the work grows faster than the input.`;
    case "overBudget":
      return `FAIL ${finding.scenario} at ${String(finding.size)}×: ${percent(finding.change)} against the baseline (limit +${String(BUDGET_TOLERANCE * 100)} %).`;
    case "otherEnvironment": {
      const { baseline, measured } = finding;
      return (
        `FAIL otherEnvironment: ${BASELINE} was counted with Node ${baseline.node} and ${baseline.valgrind}, this run with Node ${measured.node} and ${measured.valgrind}. ` +
        "The counts are not comparable, so only growth was checked. Run `npm run perf -- --update`, review the changed counts and record the maintainer's approval in the commit message."
      );
    }
    case "cheaper":
      return `${finding.scenario} at ${String(finding.size)}×: ${percent(finding.change)} against the baseline; lower it with \`npm run perf -- --update\` (maintainer's approval).`;
    case "noBaseline":
      return `${finding.scenario} has no baseline yet; add it with \`npm run perf -- --update\` (maintainer's approval).`;
    case "baselineOnly":
      return (
        `FAIL ${finding.scenario}: ${BASELINE} has it, but no scenario has that name, so a renamed scenario would escape the budget. ` +
        "Run `npm run perf -- --update` and record the maintainer's approval in the commit message."
      );
    case "noScenarios":
      return "FAIL tests/perf/scenarios.ts has no scenarios, so nothing would be measured.";
    case "duplicateScenario":
      return `FAIL ${finding.scenario}: more than one scenario has this name; perf-run.js would run the first one for each.`;
  }
}

async function gate(dir) {
  // 2. The scenario list, checked before anything is counted; then the inputs, built natively.
  const listed = checkScenarios(SCENARIOS.map((scenario) => scenario.name));
  for (const finding of listed) console.log(sentence(finding));
  if (listed.length > 0) {
    console.log("perf: failed");
    return 1;
  }
  const jobs = [{ label: "startup", args: [] }];
  SCENARIOS.forEach((scenario, s) => {
    for (const size of SIZES) {
      const path = join(dir, `${String(s)}-${String(size)}.json`);
      writeFileSync(path, scenario.input(scenario.base * size));
      jobs.push({ label: `${scenario.name} at ${String(size)}×`, args: [scenario.name, path] });
    }
  });

  // 3. and 4. The counts: startup and imports alone, then each scenario at each size.
  const results = await countAll(jobs, Math.min(4, availableParallelism()));
  const broken = results.filter((result) => result.count === undefined);
  for (const { job, stderr, collected } of broken) {
    if (collected !== undefined) {
      console.log(
        `FAIL ${job.label}: the garbage collector ran, so the count would depend on where the repository is checked out. ` +
          "Enlarge the young generation in scripts/perf.js (--min-semi-space-size, --max-semi-space-size) or shrink the scenario. V8 reported:",
      );
      console.log(collected.trimEnd().split("\n").slice(0, 5).join("\n"));
      continue;
    }
    console.log(`FAIL ${job.label}: the run failed or printed no instruction count. The last 20 lines of its stderr:`);
    console.log(stderr.trimEnd().split("\n").slice(-20).join("\n"));
  }
  if (broken.length > 0) return 1;

  // 5. The work of a scenario: its count minus that of startup and imports.
  const startup = results[0].count;
  const work = {};
  SCENARIOS.forEach((scenario, s) => {
    work[scenario.name] = SIZES.map((_, i) => results[1 + s * SIZES.length + i].count - startup);
  });
  const measured = { node: process.version, valgrind, work };

  // 6. The verdict against the baseline.
  let baseline;
  try {
    baseline = readBaseline();
  } catch (error) {
    console.log(`FAIL cannot read ${BASELINE}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const { failed, findings } = verdict(measured, baseline);

  // 7. One line per scenario, then the findings.
  const comparable = baseline !== undefined && baseline.node === measured.node && baseline.valgrind === measured.valgrind;
  console.log(`perf: Node ${measured.node}, ${valgrind}; startup and imports ${millions(startup)} instructions, subtracted`);
  for (const [name, [small, large]] of Object.entries(work)) {
    const before = comparable ? baseline.work[name] : undefined;
    const change =
      before === undefined
        ? comparable || baseline === undefined
          ? "no baseline"
          : "baseline not comparable"
        : `${percent((small - before[0]) / before[0])} / ${percent((large - before[1]) / before[1])} against the baseline`;
    console.log(`perf: ${name}  8×: ${millions(small)}  16×: ${millions(large)}  growth ${(large / small).toFixed(2)}  ${change}`);
  }

  if (update) {
    // The baseline follows the counts, unless a scenario grows faster than its input.
    const growth = findings.filter((finding) => finding.kind === "growth");
    for (const finding of growth) console.log(sentence(finding));
    if (growth.length > 0) {
      console.log(`perf: ${BASELINE} not updated`);
      return 1;
    }
    const sorted = Object.fromEntries(Object.entries(work).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    writeFileSync(join(ROOT, BASELINE), `${JSON.stringify({ node: measured.node, valgrind, work: sorted }, null, 2)}\n`);
    console.log(`perf: wrote ${BASELINE}; a raised value needs the maintainer's approval in the commit message`);
    return 0;
  }

  for (const finding of findings) console.log(sentence(finding));
  // 8. The gate's result.
  console.log(failed ? "perf: failed" : "perf: passed");
  return failed ? 1 : 0;
}

const dir = mkdtempSync(join(tmpdir(), "restlos-perf-"));
try {
  process.exitCode = await gate(dir);
} finally {
  // 9. The inputs are removed.
  rmSync(dir, { recursive: true, force: true });
}
