import { installSkill, repoSkills, skillDrift } from "../lib/skills.mjs";

export const description = "Install this repo's agent skills for Copilot and Claude (install | check)";

export default function main(args) {
  const [cmd = "install"] = args;
  if (!["install", "check"].includes(cmd)) {
    console.log("Usage: s skills [install|check]");
    process.exit(cmd === "-h" || cmd === "--help" ? 0 : 1);
  }

  const skills = repoSkills();
  if (!skills.length) {
    console.log("No skills found in skills/*/SKILL.md.");
    return;
  }

  let drifted = 0;
  for (const { name, content } of skills) {
    if (cmd === "check") {
      const stale = skillDrift(name, content);
      drifted += stale.length;
      console.log(`${stale.length ? "⚠" : "✓"} ${name}${stale.length ? " — out of sync:" : ""}`);
      for (const t of stale) console.log(`    ${t}`);
    } else {
      for (const t of installSkill(name, content)) console.log(`✓ ${name} → ${t}`);
    }
  }
  if (cmd === "check" && drifted) {
    console.log("\nRun: s skills install");
    process.exitCode = 1;
  }
}
