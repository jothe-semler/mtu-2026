// Bygger den offentlige, krypterede index.html ud fra den lokale plaintext-kilde i src/index.html.
//   npm run build                 -> skriver ./index.html
//   npm run build -- --out <fil>  -> skriver til en anden fil (fx til test)
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { root, srcFile, fail, loadEnv, secretValues, plaintextMarkers, findLeaks } from './lib.mjs';

const outIdx = process.argv.indexOf('--out');
const outFile = outIdx > 0 ? path.resolve(process.argv[outIdx + 1]) : path.join(root, 'index.html');
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%97%B3%EF%B8%8F%3C/text%3E%3C/svg%3E";

const env = loadEnv();
if (env.password.length < 12) fail('MTU_PASSWORD mangler eller er for kort (min. 12 tegn). Kør "npm run init".');
if (!/^[0-9a-f]{32}$/.test(env.salt)) fail('MTU_SALT skal være 32 hex-tegn. Kør "npm run init".');
if (env.apiSecret.length < 16) fail('MTU_API_SECRET mangler eller er for kort (min. 16 tegn).');
if (!env.apiUrl) console.warn('⚠ MTU_API_URL er tom – siden bygges, men afstemningen er lukket, indtil URL\'en er sat.');
else if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(env.apiUrl)) console.warn(`⚠ MTU_API_URL ligner ikke en Apps Script-webapp-URL: ${env.apiUrl}`);

const markers = plaintextMarkers();
const source = readFileSync(srcFile, 'utf8');
const CONFIG_MARKER = '<!--MTU_CONFIG-->';
if (!source.includes(CONFIG_MARKER)) fail(`Kilden mangler ${CONFIG_MARKER}.`);
const config = JSON.stringify({ apiUrl: env.apiUrl, apiSecret: env.apiSecret }).replace(/</g, '\\u003c');
const plain = source.replace(CONFIG_MARKER, `<script>window.__MTU_CONFIG__=${config};</script>`);

const buildDir = path.join(root, 'build');
const cleanup = () => rmSync(buildDir, { recursive: true, force: true });
// Plaintext-mellemfilen fjernes altid – også hvis build afbrydes med process.exit
process.on('exit', cleanup);
cleanup();
mkdirSync(buildDir);
try {
  const plainFile = path.join(buildDir, 'index.html');
  writeFileSync(plainFile, plain);

  const cli = path.join(root, 'node_modules', 'staticrypt', 'cli', 'index.js');
  const res = spawnSync(process.execPath, [
    cli, plainFile,
    '-d', path.join(buildDir, 'encrypted'),
    '--config', 'false',
    '--salt', env.salt,
    '--short',
    '--remember', '30',
    '--template-title', 'MTU 2026',
    '--template-instructions', 'Siden er beskyttet. Indtast adgangskoden for at fortsætte.',
    '--template-placeholder', 'Adgangskode',
    '--template-button', 'Åbn',
    '--template-remember', 'Husk mig i 30 dage',
    '--template-error', 'Forkert adgangskode – prøv igen.',
    '--template-toggle-show', 'Vis adgangskode',
    '--template-toggle-hide', 'Skjul adgangskode',
    '--template-color-primary', '#073746',
    '--template-color-secondary', '#d8e9f7'
  ], { cwd: buildDir, encoding: 'utf8', env: { ...process.env, STATICRYPT_PASSWORD: env.password } });
  if (res.status !== 0) fail(`StatiCrypt fejlede:\n${res.stderr || res.stdout}`);

  let enc = readFileSync(path.join(buildDir, 'encrypted', 'index.html'), 'utf8');
  const replaceOnce = (from, to) => {
    if (!enc.includes(from)) fail(`Forventet tekst ikke fundet i StatiCrypt-output: ${from}`);
    enc = enc.replace(from, to);
  };
  replaceOnce('<html class="staticrypt-html">', '<html lang="da" class="staticrypt-html">');
  replaceOnce('<meta charset="utf-8" />', `<meta charset="utf-8" />\n        <meta name="robots" content="noindex,nofollow" />\n        <link rel="icon" href="${FAVICON}" />`);
  // Alle apps på jothe-semler.github.io deler localStorage – brug unikke nøgler til "Husk mig"
  replaceOnce('rememberExpirationKey: "staticrypt_expiration"', 'rememberExpirationKey: "mtu2026_staticrypt_expiration"');
  replaceOnce('rememberPassphraseKey: "staticrypt_passphrase"', 'rememberPassphraseKey: "mtu2026_staticrypt_passphrase"');

  // Sikkerhedsnet: output må hverken indeholde MTU-tekst, konfiguration eller hemmeligheder i klar tekst
  const leaks = findLeaks(enc, markers, secretValues(env));
  if (enc.includes('__MTU_CONFIG__')) leaks.push('ukrypteret konfiguration');
  if (!enc.includes('staticrypt')) leaks.push('output ser ikke krypteret ud');
  if (leaks.length) fail(`Build stoppet – mulig lækage i output:\n  ${leaks.join('\n  ')}`);

  writeFileSync(outFile, enc);
  console.log(`✔ Krypteret side skrevet til ${path.relative(root, outFile) || outFile} (${(enc.length / 1024).toFixed(0)} KB, ${markers.length} tekstmarkører tjekket).`);
} finally {
  cleanup();
}
