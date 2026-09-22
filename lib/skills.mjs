// Shared helpers for installing agent skills (SKILL.md files) into every agent's personal
// skills directory. Used by `s skills` (skills owned by this repo) and by tool installers
// such as `s dd-cli` (vendor skills from a release, plus local notes).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");

// Copilot CLI / desktop and Claude Code personal skill roots.
export const AGENT_SKILL_ROOTS = [join(homedir(), ".copilot", "skills"), join(homedir(), ".claude", "skills")];

export function skillTargets(name) {
  return AGENT_SKILL_ROOTS.map((root) => join(root, name, "SKILL.md"));
}

export function installSkill(name, content) {
  const written = [];
  for (const target of skillTargets(name)) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    written.push(target);
  }
  return written;
}

// Returns the targets whose SKILL.md is missing or differs from `content`.
export function skillDrift(name, content) {
  return skillTargets(name).filter((t) => !existsSync(t) || readFileSync(t, "utf8") !== content);
}

// Skills authored in this repo: skills/<name>/SKILL.md. Directories without a SKILL.md
// (e.g. overlay notes for a vendor skill) are skipped.
export function repoSkills() {
  if (!existsSync(REPO_SKILLS_DIR)) return [];
  return readdirSync(REPO_SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(REPO_SKILLS_DIR, d.name, "SKILL.md")))
    .map((d) => ({ name: d.name, content: readFileSync(join(REPO_SKILLS_DIR, d.name, "SKILL.md"), "utf8") }));
}
