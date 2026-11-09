#!/usr/bin/env node
// Garde-fou PreToolUse : applique les limites de .claude/hooks/policies.json
// Usage dans le frontmatter d'un agent : node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard.mjs" <profil>
// Code de sortie 2 = action bloquée (le message stderr est renvoyé à l'agent).
// Refus par défaut : profil inconnu, entrée illisible, chemin introuvable => bloqué.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const profile = process.argv[2];
const here = path.dirname(fileURLToPath(import.meta.url));
const deny = (msg) => {
  console.error(`⛔ [garde:${profile}] ${msg}`);
  process.exit(2);
};

let policies;
try {
  policies = JSON.parse(fs.readFileSync(path.join(here, "policies.json"), "utf8"));
} catch {
  deny("policies.json illisible : refus par défaut.");
}
const policy = policies[profile];
if (!policy) deny("profil inconnu dans policies.json : refus par défaut.");

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
let input;
try {
  input = JSON.parse(raw);
} catch {
  deny("entrée du hook illisible : refus par défaut.");
}

const tool = input.tool_name;
const args = input.tool_input ?? {};
// Racine = racine git du répertoire courant de l'agent (le worktree pour backend/frontend).
// CLAUDE_PROJECT_DIR reste sur le checkout principal : il ne sert que de secours.
const cwd = input.cwd ?? process.cwd();
let root;
try {
  root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
} catch {
  root = process.env.CLAUDE_PROJECT_DIR ?? cwd;
}
const expand = (s) => s.replace(/\$\{(\w+)\}/g, (_, k) => policies.macros[k] ?? "");

// 1) Écriture de fichiers : uniquement dans les zones autorisées
if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const target = args.file_path ?? args.notebook_path;
  if (!target) deny("chemin du fichier introuvable.");
  const rel = path.relative(root, path.resolve(root, target)).split(path.sep).join("/");
  const zones = (policy.write ?? []).map((r) => new RegExp(r));
  if (rel.startsWith("..") || !zones.some((z) => z.test(rel))) {
    deny(
      `écriture interdite sur "${rel}". Zones autorisées : ${
        (policy.write ?? []).join("  |  ") || "aucune (agent sans droit d'écriture)"
      }. Ne contourne pas : signale le besoin à l'orchestrateur.`
    );
  }
  process.exit(0);
}

// 2) Commandes shell : uniquement celles de la liste blanche, une seule à la fois
if (tool === "Bash") {
  const cmd = String(args.command ?? "").trim();
  if (/[;&|<>`$\n\r]/.test(cmd)) {
    deny("opérateurs shell interdits (; & | < > ` $ retours à la ligne). Une commande simple à la fois.");
  }
  if (/--output|--ext-diff|--exec|--upload-pack|--fix|--write/.test(cmd)) {
    deny("option interdite pour cet agent (écriture indirecte).");
  }
  const allowed = (policy.bash ?? []).map((r) => new RegExp(expand(r)));
  if (!allowed.some((r) => r.test(cmd))) {
    deny(`commande non autorisée : "${cmd}". Voir "bash" du profil dans policies.json.`);
  }
  // Jamais de commit ni de merge directement sur main/master
  if (/^git (commit|merge)\b/.test(cmd)) {
    let branch = "";
    try {
      branch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
    } catch {}
    if (["", "main", "master"].includes(branch)) {
      deny(`commit/merge interdit sur la branche "${branch || "(détachée)"}". Travaille sur une branche feat/*.`);
    }
  }
  process.exit(0);
}

// Autres outils : non gérés par ce garde (ils sont filtrés par tools / disallowedTools)
process.exit(0);
