# Pubblicare Waxout su Google Play — cosa devi fare tu

Questa è la parte che **non posso fare io**: richiede il tuo account, i tuoi soldi e la tua firma.
Tutto il resto (compilazione, firma automatica, pacchetto) è già pronto e parte da GitHub.

---

## ⚠️ Prima cosa: una correzione

Ti avevo detto che **se perdi la chiave di firma non puoi più aggiornare l'app, mai più.**
È vero solo in parte, e la parte che cambia è importante.

Per tutte le app **nuove**, Google Play impone la **"Firma dell'app di Play"**: la chiave vera
la tiene Google, e tu ne usi una diversa — la **chiave di caricamento** — solo per firmare i file
che carichi. Se perdi *quella*, **Google te la può reimpostare**: apri una richiesta, ne generi
una nuova, e riprendi. L'app non muore.

Resta comunque una cosa da custodire bene, perché reimpostarla costa tempo e passa da
un'assistenza. Ma non è la catastrofe irreversibile che ti avevo descritto.

---

## In che ordine muoverti

Le cose sono in quest'ordine per un motivo: il punto 3 ha **14 giorni di attesa** dentro, quindi
va fatto partire il prima possibile, mentre il resto si sistema in parallelo.

### 1. Apri l'account Google Play Console
- Costo: circa **25 dollari, una volta sola** (non è un abbonamento).
- ⚠️ Ti chiede subito se l'account è **personale** o **aziendale**, e *dopo non si cambia*.
  Personale è immediato. Aziendale richiede partita IVA e un codice D-U-N-S (si richiede
  gratis, ma ci vogliono giorni).
- Se scegli personale, Google mostra pubblicamente il tuo **nome e indirizzo** sulla scheda
  dell'app. Se la cosa non ti va bene, è un motivo per valutare l'account aziendale.

### 2. Accendi GitHub Pages (2 minuti)
Serve perché l'informativa sulla privacy abbia un indirizzo pubblico, che Play chiede
obbligatoriamente.
- Vai su GitHub → il repository → **Settings** → **Pages**
- Sorgente: **Deploy from a branch**, ramo `main`, cartella **`/docs`** → Save
- Dopo qualche minuto l'indirizzo sarà:
  `https://ivocativo.github.io/WaxOut/privacy.html`
  ⚠️ L'indirizzo distingue maiuscole e minuscole: è `WaxOut`, non `waxout`.
- Aprilo e controlla che si veda. È quello che incollerai in Play Console.

### 3. Metti insieme i 12 tester — **inizia subito**
Se l'account è **personale**, Google chiede un **test chiuso con almeno 12 tester per 14 giorni
consecutivi** prima di lasciarti pubblicare davvero.
- Non sono 12 installazioni: sono **12 account Google** che elenchi tu e che devono tenere
  l'app installata.
- I 14 giorni partono da quando il test è attivo, quindi **è il collo di bottiglia di tutto**.
- Amici e parenti vanno benissimo. Ti serve il loro indirizzo Gmail.

### 4. Prepara la chiave di caricamento (una volta sola)

Sul tuo PC non c'è Java, che serve per lo strumento `keytool`. Si installa una volta e si può
anche disinstallare dopo.

**a) Installa Java** (in PowerShell):
```
winget install EclipseAdoptium.Temurin.21.JDK
```
Poi **chiudi e riapri** PowerShell, se no non trova il comando nuovo.

**b) Genera la chiave** — scegli TU una password e scrivitela subito da qualche parte:
```
keytool -genkeypair -v -keystore waxout-upload.keystore -alias waxout -keyalg RSA -keysize 2048 -validity 10000
```
Ti chiederà la password (due volte) e qualche dato anagrafico: nome, città, paese. Puoi mettere
i tuoi. Alla fine avrai il file `waxout-upload.keystore` nella cartella dove ti trovi.

**c) Mettilo al sicuro.** Copia il file **e** la password in almeno due posti diversi (per esempio
un gestore di password e una chiavetta). Non nella cartella del gioco: quella finisce su GitHub.

**d) Convertilo in testo**, perché GitHub accetta solo testo nei segreti:
```
[Convert]::ToBase64String([IO.File]::ReadAllBytes("waxout-upload.keystore")) | Set-Clipboard
```
Così il testo è già negli appunti, pronto da incollare.

### 5. Metti i quattro segreti su GitHub
Repository → **Settings** → **Secrets and variables** → **Actions** → *New repository secret*.
Uno alla volta, con questi nomi esatti:

| nome | cosa ci va |
|---|---|
| `KEYSTORE_BASE64` | il testo che hai negli appunti dal punto 4d |
| `KEYSTORE_PASSWORD` | la password che hai scelto |
| `KEY_ALIAS` | `waxout` |
| `KEY_PASSWORD` | la stessa password (a meno che tu ne abbia messa una diversa) |

⚠️ I segreti non si possono più rileggere dopo averli salvati, solo sostituire. È normale.

### 6. Genera il pacchetto per Play
Repository → tab **Actions** → workflow **"Pacchetto per Google Play (AAB firmato)"** →
**Run workflow** → scrivi il numero di versione (la prima volta `1.0.0`) → conferma.

Alla fine trovi da scaricare un file `Waxout-1.0.0.aab`: è quello che si carica su Play Console.

---

## Cosa fa il pacchetto di rilascio, che l'APK di prova non fa

- **Formato AAB** invece di APK: Play non accetta più gli APK per le app nuove.
- **Firmato** con la tua chiave.
- **Pannello di taratura spento.** Lo spegne il workflow, in automatico, nella copia usata per la
  compilazione — il file del progetto resta com'è, così tu continui a usarlo per provare.
  Se un domani quella riga cambiasse forma, la compilazione **si ferma con un errore** invece di
  sfornare in silenzio un gioco con vita infinita.
- **Numero di versione che cresce da solo:** Play rifiuta due caricamenti con lo stesso numero.

---

## Cosa manca ancora, e chi lo fa

| cosa | chi |
|---|---|
| Immagine di copertina 1024×500 | io |
| Schermate del gioco per la scheda | io |
| Descrizione breve e lunga | io |
| Questionario sulla classificazione dei contenuti | tu (sono domande sul contenuto del gioco) |
| Scheda "Sicurezza dei dati" | tu — la risposta è "nessun dato raccolto", vedi `privacy.html` |
| Commercialista, se pensi di monetizzare | tu |

---

## Il difetto ancora aperto

Il **blocco allo Start Run sul PC** non è risolto: non si riproduce fuori dal tuo computer.
Prima di pubblicare vale la pena chiudere il dubbio, ed è una prova da due minuti:

1. apri il gioco sul PC e fai Start Run — se si blocca, prosegui;
2. riapri lo stesso indirizzo aggiungendo **`?nofx`** in fondo, e riprova.

Se col `?nofx` **non** si blocca, il colpevole è l'effetto grafico sul cerume e sappiamo dove
mettere le mani. Se si blocca lo stesso, quel sospetto cade e si cerca altrove.

Sul telefono il gioco ha sempre funzionato, quindi non è un ostacolo alla pubblicazione — ma è
meglio saperlo prima che dopo, perché lo stesso effetto potrebbe dare problemi su qualche
telefono Android che non abbiamo mai provato.
