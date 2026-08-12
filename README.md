# Newsletter blog → GoHighLevel

Ricostruzione dell'automazione "La settimana in digital": legge gli articoli del blog
di **giovanniperilli.com**, li impila nell'email HTML (template originale, brand #D2722E)
e — con `--push` — crea il template su **GoHighLevel**.

## Come funziona
- **Fonte**: API REST pubblica di WordPress (`/wp-json/wp/v2/posts`), filtrata sulla lingua
  italiana (gli articoli EN hanno `/en/` nel link) e sulla finestra temporale scelta.
- **Template**: `template.mjs` riproduce esattamente l'email che incollavi in GHL.
- **Copy**: intro e blurb partono dagli estratti WP e si rifiniscono a mano nel file
  `build/<data>.content.json`.

## Uso

### Automatico (per il cron del venerdì)
```bash
node newsletter.mjs --auto
```
Legge il blog (ultimi 7 giorni) → genera intro+blurb con Claude → costruisce l'HTML →
**aggiorna l'unico template** in GHL (idempotente per titolo, zero accumulo). Non invia:
Giovanni duplica la campagna dal template e invia a mano. Richiede `ANTHROPIC_API_KEY` + `GHL_*`.

### Manuale (con rifinitura a mano)
```bash
# 1) genera la copy grezza dagli estratti WP
node newsletter.mjs --days 7 --before 2026-08-16
#    -> build/<data>.content.json  (copy da rifinire)  / .html (anteprima) / .table.html

# 2) rifinisci intro/blurb nel .content.json, poi HTML definitivo
node newsletter.mjs --content build/<data>.content.json

# 3) verifica permessi token, poi aggiorna il template su GHL
node newsletter.mjs --content build/<data>.content.json --probe
node newsletter.mjs --content build/<data>.content.json --push
```

## Limite GHL (importante)
Con un Private Integration Token, l'API GHL crea/aggiorna **solo il template**, non le
campagne (`POST /emails/schedule` → 401 anche con tutti gli scope). Quindi la routine
mantiene aggiornato il template; la **campagna la crea/invia Giovanni** dall'editor.

## Deploy su Render (gratis, web service sempre acceso)
`render.yaml` definisce un **web service** (`server.mjs`) con:
- **scheduler interno** (node-cron): venerdì **07:00 Europe/Rome** → `newsletter.mjs --auto`
- **self-ping** ogni 14 min (usa `RENDER_EXTERNAL_URL`) per non farlo dormire sul piano free
- `/healthz` (health check), `/` (stato ultimo run), `/run?token=RUN_TOKEN` (trigger manuale)

Passi:
1. Metti la cartella in un repo Git e collegalo a Render (New → Blueprint, legge `render.yaml`).
2. Nel dashboard imposta i segreti: `GHL_EMAIL_TOKEN`, `GHL_USER_ID`, `ANTHROPIC_API_KEY`,
   `RUN_TOKEN` (una stringa a caso).
3. Deploy. Testa aprendo `https://<app>.onrender.com/run?token=<RUN_TOKEN>`, poi guarda `/`.

`server.mjs` = produzione; `node newsletter.mjs --auto` resta il comando singolo da lanciare a mano.

## Push su GHL
Serve un token con permesso di **scrittura** sulle email. Copia `.env.example` in `.env`:
```
GHL_EMAIL_TOKEN=...        # scope emails/builder
GHL_LOCATION_ID=65dgBotw4hBLniJ5BTL2
GHL_USER_ID=               # opzionale
```
Il token vive solo in `.env` (gitignored): mai nel codice, mai in chat. `--probe` interroga
gli endpoint email per confermare cosa il token può fare prima di scrivere.

## File
- `newsletter.mjs` — CLI / orchestratore
- `wp.mjs` — lettura articoli dal blog
- `template.mjs` — costruzione HTML (template identico all'originale)
- `ghl.mjs` — probe + creazione template su GoHighLevel
