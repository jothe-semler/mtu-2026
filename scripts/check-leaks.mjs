// Tjekker, at hverken MTU-tekst i klar tekst eller hemmeligheder fra .env findes i:
//   1) filer, der er/bliver en del af git-repoet (staged + ikke-ignorerede nye filer)
//   2) hele git-historikken (alle commits og grene)
// og at src/, .env og build/ faktisk er ignoreret. Kør før hvert push:  npm run check
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { root, fail, loadEnv, secretValues, plaintextMarkers, findLeaks } from './lib.mjs';

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  return r;
};

if (git('rev-parse', '--is-inside-work-tree').status !== 0) fail('Mappen er ikke et git-repo.');

for (const p of ['src/index.html', '.env', 'build/index.html', '.staticrypt.json']) {
  if (git('check-ignore', '-q', p).status !== 0) fail(`${p} er IKKE ignoreret af .gitignore!`);
}

const markers = plaintextMarkers();
const secrets = secretValues(loadEnv());
const problems = [];

const list = (...args) => git('ls-files', '-z', ...args).stdout.split('\0').filter(Boolean);
for (const f of list('--cached')) {
  const blob = git('show', `:${f}`);
  if (blob.status !== 0) continue; // fx slettet i index
  for (const hit of findLeaks(blob.stdout, markers, secrets)) problems.push(`${f} (staged): ${hit}`);
}
for (const f of list('--others', '--exclude-standard')) {
  const text = readFileSync(path.join(root, f), 'utf8');
  for (const hit of findLeaks(text, markers, secrets)) problems.push(`${f} (ny fil): ${hit}`);
}

const hasCommits = git('rev-parse', '--verify', 'HEAD').status === 0;
if (hasCommits) {
  const log = git('log', '--all', '-p', '--text', '--format=commit %H%n%an %ae%n%B');
  if (log.status !== 0) fail(`git log fejlede: ${log.stderr}`);
  for (const hit of findLeaks(log.stdout, markers, secrets)) problems.push(`git-historik: ${hit}`);
}

if (problems.length) fail(`Lækage fundet – push IKKE:\n  ${problems.join('\n  ')}`);
console.log(`✔ Ingen lækage: ${markers.length} tekstmarkører og ${secrets.length} hemmeligheder tjekket mod repo-filer${hasCommits ? ' og hele git-historikken' : ''}.`);
