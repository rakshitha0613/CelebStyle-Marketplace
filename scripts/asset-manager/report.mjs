/**
 * Batch report — printed after every run (requirement #10), not just the
 * review batch. Summarizes the manifest against a given set of slot paths
 * (or the whole manifest when no slot list is given).
 */
import { writeFileSync } from "fs";
import { getSlot } from "./manifest.mjs";

/**
 * @param {object} manifest
 * @param {{path:string}[]} slots the slots this run targeted
 */
export function buildReport(manifest, slots) {
  const counts = {
    generated: 0,
    failed: 0,
    pending: 0, // never-attempted
    needsPaidUpgrade: 0,
    brokenReferences: 0,
  };
  const failedDetails = [];

  for (const slot of slots) {
    const entry = getSlot(manifest, slot.path);
    if (entry.status === "generated") counts.generated++;
    else if (entry.status === "failed") {
      counts.failed++;
      failedDetails.push({ path: slot.path, error: entry.error, attempts: entry.attempts });
    } else if (entry.status === "broken") counts.brokenReferences++;
    else counts.pending++;

    if (entry.needsPaidUpgrade) counts.needsPaidUpgrade++;
  }

  return { counts, failedDetails, total: slots.length };
}

export function printReport(report) {
  const { counts, failedDetails, total } = report;
  console.log(`\n─── Batch report (${total} slots) ───`);
  console.log(`  generated:                 ${counts.generated}`);
  console.log(`  failed:                    ${counts.failed}`);
  console.log(`  pending / never-attempted: ${counts.pending}`);
  console.log(`  needsPaidUpgrade:          ${counts.needsPaidUpgrade}`);
  console.log(`  brokenReferences:          ${counts.brokenReferences}`);
  if (failedDetails.length > 0) {
    console.log(`\n  Failed slots:`);
    for (const f of failedDetails) {
      console.log(`    ✗ ${f.path} — ${f.error} (attempts: ${f.attempts})`);
    }
  }
  console.log("");
}

export function toMarkdown(report) {
  const { counts, failedDetails, total } = report;
  const lines = [
    `# Asset generation batch report`,
    ``,
    `Total slots: ${total}`,
    ``,
    `| Status | Count |`,
    `|---|---|`,
    `| generated | ${counts.generated} |`,
    `| failed | ${counts.failed} |`,
    `| pending / never-attempted | ${counts.pending} |`,
    `| needsPaidUpgrade | ${counts.needsPaidUpgrade} |`,
    `| brokenReferences | ${counts.brokenReferences} |`,
  ];
  if (failedDetails.length > 0) {
    lines.push(``, `## Failed slots`, ``);
    for (const f of failedDetails) {
      lines.push(`- \`${f.path}\` — ${f.error} (attempts: ${f.attempts})`);
    }
  }
  return lines.join("\n") + "\n";
}

export function writeReportFile(report, format, outPath) {
  const content = format === "json" ? JSON.stringify(report, null, 2) : toMarkdown(report);
  writeFileSync(outPath, content, "utf8");
}
