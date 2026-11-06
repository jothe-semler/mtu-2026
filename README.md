# MTU 2026 – afstemning

Adgangskodebeskyttet side med teamets MTU 2026-resultater og en anonym afstemning. Hver medarbejder vælger
**3 styrker**, som vi skal fortsætte med at styrke, og **3 forbedringer**, som vi skal arbejde på at forbedre.
Stemmerne gemmes i Google Sheets via et Google Apps Script.

**Live:** https://jothe-semler.github.io/mtu-2026/ (kræver adgangskode)

## Funktioner

- **Stem**: Viser alle spørgsmål med snit, positiv distribution og udvikling ift. 2025. Du skal vælge præcis 3 styrker og 3 forbedringer, og et spørgsmål kan kun vælges som én af delene. Inden afsendelse vises en bekræftelse.
- **Afstemning**: Viser antal stemmer pr. spørgsmål for styrker og forbedringer. Top 3 i hver kolonne er fremhævet, og ved delt placering fremhæves alle med samme antal. Siden opdateres automatisk hvert 30. sekund.
- **Anonymt**: Der gemmes ingen navne, kun tidspunkt, et tilfældigt stemme-id og de valgte spørgsmåls-id'er (`q01`–`q28`).
- **Én stemme pr. browser**: Blokeres via `localStorage`. Det er en bevidst simpel løsning uden login, så den kan omgås ved at rydde browserdata eller bruge en anden browser.

## Sikkerhed – hvad er offentligt?

Repoet er offentligt (GitHub Free kræver det for Pages), så alt følsomt holdes uden for git:

| Fil | I repoet? | Indhold |
| --- | --- | --- |
| `index.html` | Ja | **Kun krypteret** med StatiCrypt (AES-256 + HMAC, PBKDF2-SHA256 med 600.000 iterationer). Uden adgangskoden er indholdet ulæseligt. |
| `apps-script/Code.gs` | Ja | Backend-kode uden hemmeligheder |
| `scripts/` | Ja | Build- og tjekscripts (indeholder ingen MTU-data) |
| `src/index.html` | **Nej** (gitignored) | Plaintext-kilden med MTU-data |
| `.env` | **Nej** (gitignored) | Adgangskode, API-nøgle, Apps Script-URL og salt |

API-nøglen (`MTU_API_SECRET`) findes kun inde i den krypterede side og i Apps Scripts *Scriptegenskaber*. Uden adgangskoden til siden kan man hverken stemme eller læse stemmerne.

`npm run build` stopper, hvis outputtet indeholder MTU-tekst i klar tekst eller værdier fra `.env`. `npm run check` tjekker alle filer i repoet og hele git-historikken for det samme. Kør det før hvert push.

## Lokal udvikling

Kræver Node.js 20.12 eller nyere.

```powershell
npm install
npm run init     # opretter .env med adgangskode, API-nøgle og salt (kun første gang)
                 # læg plaintext-kilden i src/index.html (gemmes kun lokalt)
npm run build    # krypterer src/index.html -> index.html
npm run check    # tjekker repo og git-historik for lækage
git add index.html
git commit -m "Opdater side"
git push
```

`.env` har følgende felter:

| Variabel | Beskrivelse |
| --- | --- |
| `MTU_PASSWORD` | Adgangskoden til siden, som deles med teamet |
| `MTU_API_SECRET` | Delt nøgle mellem siden og Apps Script |
| `MTU_API_URL` | Apps Script-webappens URL (ender på `/exec`) |
| `MTU_SALT` | StatiCrypt-salt. Behold værdien, så "Husk mig" fortsat virker efter nye builds |

## Opsætning af Google Sheets (én gang)

1. Gå til [sheets.new](https://sheets.new) og opret et nyt regneark, fx med navnet *MTU 2026 – afstemning*.
2. Vælg **Udvidelser → Apps Script**.
3. Slet alt i `Code.gs` i editoren, og indsæt hele indholdet af [`apps-script/Code.gs`](apps-script/Code.gs). Tryk **Gem** (💾).
4. Klik på tandhjulet **Projektindstillinger** i venstre side. Under **Scriptegenskaber** vælger du **Tilføj scriptegenskab**:
   - Egenskab: `API_SECRET`
   - Værdi: værdien af `MTU_API_SECRET` fra `.env`

   Tryk **Gem scriptegenskaber**.
5. Gå tilbage til **Editor** (`< >`). Funktionen `opsaetning` er valgt som standard i rullemenuen øverst. Tryk **Kør**.
   - Godkend adgang med din Google-konto. Hvis Google viser *"Google har ikke bekræftet denne app"*, skal du vælge **Avanceret → Gå til … (usikker)**, fordi det er dit eget script.
   - Fanen **Stemmer** bliver oprettet i regnearket.
6. Vælg **Implementer → Ny implementering**. Klik på tandhjulet ved *Vælg type*, og vælg **Webapp**.
   - Beskrivelse: `v1`
   - Udfør som: **Mig**
   - Hvem har adgang: **Alle**

   Tryk **Implementer**, og kopiér **webappens URL**, som ender på `/exec`.
7. Test URL'en i en browser. Du skal se `{"ok":true,"service":"mtu-afstemning","configured":true}`.
8. Indsæt URL'en som `MTU_API_URL` i `.env`. Kør derefter `npm run build`, `npm run check`, commit og push.

> **Bemærk:** Hvis *"Alle"* ikke kan vælges i trin 6, fordi firmaets Google Workspace begrænser det, skal du bruge en privat Google-konto. Regnearket indeholder kun spørgsmåls-id'er og ingen MTU-tekster.

### Når Code.gs ændres senere

Vælg **Implementer → Administrer implementeringer**, klik på blyanten, vælg **Version: Ny version** og tryk **Implementer**. URL'en forbliver den samme.

## Drift

- **Se stemmerne**: Åbn fanen *Stemmer* i regnearket. Én række svarer til én stemme.
- **Nulstil afstemningen**: Slet alle rækker under overskriften i fanen *Stemmer*. Browsere, der allerede har stemt, er stadig blokeret lokalt. Hvis du vil starte en ny runde, skal du ændre `VOTE_KEY` i `src/index.html` (fx `mtu2026.vote.v2`) og bygge igen.
- **Skift adgangskode**: Ret `MTU_PASSWORD` i `.env`, byg og push. Gemte "Husk mig"-logins bliver automatisk ugyldige.
- **Skift API-nøgle**: Ret både `MTU_API_SECRET` i `.env` og `API_SECRET` i Scriptegenskaber. Byg og push derefter.
