// Opretter .env med et stærkt kodeord, en API-nøgle og et salt. Overskriver aldrig en eksisterende .env (brug --force).
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { envFile } from './lib.mjs';

const force = process.argv.includes('--force');
if (existsSync(envFile) && !force) {
  console.log('.env findes allerede – intet ændret. Brug "npm run init -- --force" for at generere nye værdier.');
  process.exit(0);
}

// Korte danske ord uden æ/ø/å, så kodeordet er nemt at taste på alle tastaturer
const WORDS = [...new Set(`
ager agurk alarm anker appel april arena asfalt atlas avis bad bager ballon banan bane bark bil birk bjerg blad
blink blomst blyant bog bold bonde bord borg bro bryg bunke bus butik cirkus cykel dal dans delfin digt dok
drage due dyne egern elev elg engel falk farve fasan figen film fisk fjer fjord flag flod fold fort frugt fugl
gade gaffel gave glas gran gris grotte gryde gulv hage hagl hal hammer hane hat hav havre hest honning horn hund
hus hvede hytte jakke jord juli juni kage kakao kamel kanal kande kano kat kaffe kiks kilde kirke kiste klippe
klit klokke knap kniv kobber kok kompas kop kort krage krans kridt krone kuffert kurv lagen lampe land laks lam
lilje linse lomme lotus lyng maj mango mark marts maske mast melon mos motor mus musik mynte nat net oase okse
oliven ost otter pakke palme papir park pause peber pen pibe pil pirat planet plante pose post puma pude pumpe
radio regn rejse ring robot rose rug ruin salat salt sand sejl sild sko skab skib skov sky slot sne sol sommer
spade spejl stald sten stjerne stol storm strand sukker svamp svane tag tand tang tavle telt tiger tog top torv
trappe tromme tulipan tunnel ugle ulv ur vaffel vej vind vindue vinter vulkan zebra anis basun bille bjelke bue
dommer drik fakkel fiol flamme gitter guld hjelm hvalp kegle kirsebar kompost korn kran lakrids mandel marmor
nisse orgel pande pingvin rabarber rokke safir skilt slange snegl spurv stork tranebar trold valnod violin
`.trim().split(/\s+/))];

const pick = () => WORDS[randomInt(WORDS.length)];
const password = [pick(), pick(), pick(), pick(), pick()].join('-') + '-' + randomInt(10, 100);
const apiSecret = randomBytes(32).toString('base64url');
const salt = randomBytes(16).toString('hex');
const bits = (5 * Math.log2(WORDS.length) + Math.log2(90)).toFixed(0);

writeFileSync(envFile, `# MTU 2026 – lokale hemmeligheder. Må ALDRIG committes (står i .gitignore).
# Adgangskode til den krypterede side (deles med teamet)
MTU_PASSWORD=${password}
# Delt nøgle mellem siden og Google Apps Script (indsættes som Script Property "API_SECRET")
MTU_API_SECRET=${apiSecret}
# Webapp-URL fra Apps Script (ender på /exec) – udfyldes efter opsætning af Google Sheets
MTU_API_URL=
# Salt til StatiCrypt. Behold den samme værdi, så "Husk mig" virker på tværs af builds
MTU_SALT=${salt}
`);

console.log(`.env oprettet (kodeord ≈ ${bits} bits entropi, ${WORDS.length} ord i ordlisten).`);
console.log(`  Kodeord til siden:   ${password}`);
console.log(`  API_SECRET:          ${apiSecret}`);
