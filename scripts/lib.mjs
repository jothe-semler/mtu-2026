// Fælles hjælpefunktioner til build- og tjekscripts.
// Indeholder bevidst INGEN MTU-data eller hemmeligheder – de læses fra src/ og .env (begge gitignored).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const srcFile = path.join(root, 'src', 'index.html');
export const envFile = path.join(root, '.env');

export function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

export function loadEnv() {
  // Eksisterende miljøvariabler har forrang for værdier i .env
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const env = {
    password: (process.env.MTU_PASSWORD || '').trim(),
    apiSecret: (process.env.MTU_API_SECRET || '').trim(),
    apiUrl: (process.env.MTU_API_URL || '').trim(),
    salt: (process.env.MTU_SALT || '').trim().toLowerCase()
  };
  return env;
}

// Værdier, der aldrig må optræde i ukrypteret form i det offentlige repo
export function secretValues(env) {
  return [env.password, env.apiSecret, env.apiUrl].filter(v => v && v.length >= 8);
}

// Udtrækker kendetegnende tekst fra plaintext-kilden (spørgsmål, kategorier, teamnavn, KPI'er),
// så vi kan bevise, at den ikke findes i nogen fil, der publiceres.
export function plaintextMarkers() {
  if (!existsSync(srcFile)) fail(`Mangler ${path.relative(root, srcFile)} (plaintext-kilden ligger kun lokalt).`);
  const src = readFileSync(srcFile, 'utf8');
  const markers = new Set();
  const data = src.match(/\/\*DATA:BEGIN\*\/([\s\S]*?)\/\*DATA:END\*\//);
  if (!data) fail('Kunne ikke finde /*DATA:BEGIN*/ … /*DATA:END*/ i kilden.');
  for (const m of data[1].matchAll(/(["'])((?:(?!\1).){10,})\1/g)) markers.add(m[2]);
  for (const block of src.matchAll(/<!--SENSITIVE:BEGIN-->([\s\S]*?)<!--SENSITIVE:END-->/g)) {
    for (const t of block[1].replace(/<[^>]+>/g, '\n').split('\n')) {
      const s = t.trim();
      if (s.length >= 8) markers.add(s);
    }
  }
  if (markers.size < 20) fail(`For få tekstmarkører fundet i kilden (${markers.size}) – lækagetjekket ville være upålideligt.`);
  // Tjek også HTML-escapede varianter
  for (const m of [...markers]) markers.add(m.replace(/&/g, '&amp;'));
  return [...markers];
}

export function findLeaks(text, markers, secrets) {
  const hits = [];
  for (const m of markers) if (text.includes(m)) hits.push(`MTU-tekst: "${m.slice(0, 40)}…"`);
  for (const s of secrets) if (text.includes(s)) hits.push('hemmelighed fra .env');
  return hits;
}
