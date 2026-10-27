# Design-Plan: Datei-Variablen (Web-LaTeX „starter“, Online-IDE „assignments“)

Mockup: [`mockup/index.html`](mockup/index.html), interaktiv (Schalter „Heute / Neu“, App, 3 oder 12 Studierende, Je Person / Je Team, Beschreibung der App mit / ohne). Gleiche Designsprache wie das Windows-VM-Design aus [frontend#109](https://github.com/DHBW-AppStore-T3/frontend/issues/109).

Bilder (Ist-Zustand und Ansichten des Mockups): [`0-ist-zustand`](screenshots/0-ist-zustand.png), [`1-neu-leer`](screenshots/1-neu-leer.png), [`2-neu-datei-fuer-alle`](screenshots/2-neu-datei-fuer-alle.png), [`3-neu-beschreibung-offen`](screenshots/3-neu-beschreibung-offen.png), [`4-neu-pro-person`](screenshots/4-neu-pro-person.png), [`5-neu-fehler-gesamtgroesse`](screenshots/5-neu-fehler-gesamtgroesse.png), [`6-neu-mobil`](screenshots/6-neu-mobil.png).

## 1. Worum es geht
- **Nutzer:** nicht technischer Dozent. Er richtet Web-LaTeX oder die Online-IDE für einen Kurs ein und kann optional eine ZIP-Datei mitgeben (Startprojekt bzw. Aufgaben).
- **Aufgabe der Seite:** eine Datei auswählen, wissen, wer sie bekommt, und erst beim Deployen nicht überrascht werden.
- **Was heute da ist** (Screenshot Web-LaTeX): lila Karte „App-Einstellungen“, darin eine Karte mit dem technischen Namen `starter`, einem Schild „STRING“, „Pro Team“, einem lila Infokasten („Pro Team ein eigener Wert … eine Eingabe pro Team“) und je Team eine eigene Ablegefläche „Team #1: Datei wählen oder hier ablegen, max. 2 MB“.

## 2. Befund (aus Code, Backend und Staging geprüft)

**Was die App dem Frontend gibt** (`GET /apps/{id}/variables`, gebaut aus `appstore.yaml`): nur `name` (`starter`), `type: "string"`, `osType: "file"`, `osScope`/`varScope: "team"`, `fileExtensions: ["zip"]`, `required: false`. **Kein Label, keine Beschreibung, keine Größengrenze.** Die erklärenden Sätze stehen nur als Kommentar in der `appstore.yaml` („Optional starter project per team … without it the editor starts with the bundled demo project“).

**Was heute schiefgehen kann:**
| # | Befund | Folge für den Dozenten |
|---|---|---|
| 1 | Die Oberfläche sagt „max. 2 MB“ (`FileDropZone`, Standard 2 MB). Das Backend erlaubt für Pod-Apps höchstens **1 MiB** pro Datei (`maxSize` der App, nie über 1 Mi; `_check_pod_files` → 413 `file_too_large`) | Eine 1,5-MB-Datei wird angenommen und scheitert erst beim Deployen |
| 2 | Beim **Ablegen** per Drag & Drop prüft `processFile` nur die Größe, nicht die Endung. Nur der Dateidialog filtert (`accept`) | Eine PDF lässt sich ablegen, das Backend lehnt sie beim Deployen mit 422 ab |
| 3 | Alle Dateien einer Bereitstellung zusammen dürfen höchstens **10 MiB** groß sein (`deployment_input.py`, 413 `deployment_files_too_large`) | Dieselbe 1-MB-Datei für 12 Teams sind 12 MB: nicht mehr zulässig, und nirgends vorher erkennbar |
| 4 | Die Karte heißt `starter` und trägt das Schild „STRING“ | Weder Name noch Typ sagen etwas über „ein Startprojekt als ZIP“ |
| 5 | Bei Web-LaTeX und Online-IDE läuft jede Person als eigenes Team (`scope: user`), die Karten heißen „Team #1, #2, #3“ | Der Dozent muss raten, welche Person „Team #2“ ist |
| 6 | Dieselbe Datei für alle bedeutet heute: dieselbe Datei n-mal ablegen | Bei 30 Studierenden 30 Mal klicken |

## 3. Review des ersten Entwurfs
Der erste Gedanke war: die lila Karte rot einfärben, die gestrichelten Flächen pro Team beibehalten, „Pro Team“ als rotes Schild lassen. Das ist ein Farbwechsel, keine Verbesserung. Er löst weder 1 bis 6 noch die Frage, was der Dozent eigentlich entscheiden will.

| Verworfen | Warum | Stattdessen |
|---|---|---|
| Je Team/Person eine große Ablegefläche (heute) | Der häufigste Fall (ein ZIP für alle) braucht n Aktionen; bei 30 Personen unbenutzbar | **Eine Datei für alle** als Standard: ein Ablagepunkt, ein Klick |
| Eine Tabelle mit Dropzone in jeder Zeile als Standard | Dasselbe Problem, nur dichter | Zeilen mit eigener Ablage erst in der Wahl **„Pro Person unterschiedlich“** |
| Standard „für alle“ ohne Ausnahme | Gruppenarbeit mit je eigener Aufgabe (der Zweck von `assignments`) wäre nicht möglich | Zwei klar benannte Wahlmöglichkeiten statt Sonderlogik |
| Grenzen erst beim Deployen merken | Die Datei ist ausgewählt, der Fehler kommt spät und aus dem Cluster | **Prüfung beim Ablegen:** Endung, Dateigröße, Gesamtgröße. Die Größengrenze je Datei wird **nicht angezeigt** (Vorgabe), nur bei Überschreitung gemeldet, ohne Zahl |
| „Pro Team ein eigener Wert“-Kasten | Systemsprache („Wert“, „Eingabe“) | Ein Satz unter der Wahl, der sagt, wer was bekommt |

**Signatur:** *Die Leiste.* Unter der Ablagefläche steht eine senkrechte Leiste mit einem Punkt je Empfänger. Gefüllter roter Punkt: bekommt eine Datei. Leerer Ring: keine Datei. Beim Ablegen füllen sich die Punkte nacheinander. Das ist die einzige Bewegung auf der Seite, und sie trägt Information (wer ist versorgt). Alles andere bleibt ruhig.

## 4. Designsystem
Dieselben Tokens wie beim Windows-VM-Design (`src/theme/themes/t3.ts`), nichts Neues:

| Rolle | Token | Einsatz |
|---|---|---|
| DHBW-Rot `#E2001A` | `primary` | gefüllter Punkt, Rand der Schaltfläche „Datei auswählen“, Fokus, aktive Datei-Chips |
| Rot dunkel / tief | `primaryDark` / `primaryDeep` | Text der Textlinks („Ersetzen“) / aktive Wahl, Icon, Dateiname im Chip |
| Rosé | `primaryFaint` / `primarySoft` | Icon-Fläche, Datei-Karte, Chip, Ziehen-Zustand, Linie zwischen gefüllten Punkten |
| Tinte / Schiefer | `textHeading` / `textStrong` | Titel, Dateiname / Hilfetexte, „Keine Datei“ |
| Flächen und Linie | `surface`, `surfacePage`, `surfaceMuted`, `borderSubtle` | Karte, Ablagefläche, Wahlschalter und Summenzeile, Trennlinien |
| Fehler | `danger` / `dangerTint` | Fehlermeldung. Bewusst nicht das Marken-Rot der Bedienung |

**Kontrast (gemessen):** `danger` auf `dangerTint` 5,30:1; `primaryDark` auf `primaryFaint` 5,55:1; `primaryDeep` auf `primaryFaint` 8,03:1; `textStrong` auf `surfaceMuted` 12,2:1; Knoten `primary` auf Weiß 4,94:1. `textMuted` (4,37:1) nur für Deko. Der gestrichelte Rand der Ablagefläche (`borderStrong`, 2,62:1) ist nicht die einzige Kennzeichnung: Icon, Text und Schaltfläche tragen die Erkennbarkeit.
**Typografie:** Inter, `tabular-nums` für Größen. Titel `text-base font-bold`, Hilfetext `text-sm`, Mikro-Labels (Chips, „Empfänger“) `text-xs font-bold uppercase tracking-wider`, wie die Stepper-Beschriftungen.
**Form:** Karte `rounded-xl`, Icon-Fläche `rounded-lg`, Wahlschalter `rounded-xl`, Schaltflächen und Chips `rounded-full`.

## 5. Layout
Schmale Spalte (`max-w-3xl`, 720 px) wie bei der Windows-Seite. Eine Karte pro Datei-Variable.

```
Eine Datei für alle, noch leer
┌──────────────────────────────────────────────────────────┐
│ [🗜]  Starter-Projekt                           OPTIONAL │
│       Beschreibung anzeigen ⌄                             │
│ ┌──────────────────────────┬───────────────────────────┐ │
│ │  Eine Datei für alle     │ Pro Person unterschiedlich│ │
│ └──────────────────────────┴───────────────────────────┘ │
│ Alle 3 Studierenden bekommen dieselbe Datei.              │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│ │ (⬆) ZIP-Datei hier ablegen        [Datei auswählen]  │ │
│ │     Optional · gilt für alle 3 Studierenden          │ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│ EMPFÄNGER                                                 │
│ ○  Studentin Drei                              Keine Datei│
│ │                                                         │
│ ○  Student Zwei                                Keine Datei│
│ ○  Student Vier                                Keine Datei│
└──────────────────────────────────────────────────────────┘

Datei da (für alle)
│ ┌────────────────────────────────────────────────────┐  │
│ │ [🗜] starter.zip                  Ersetzen Entfernen│  │
│ │      640 KB · gilt für alle 3 Studierenden          │  │
│ └────────────────────────────────────────────────────┘  │
│ EMPFÄNGER                                                 │
│ ●  Studentin Drei                              starter.zip│
│ │                                                         │
│ ●  Student Zwei                                starter.zip│
│ ●  Student Vier                                starter.zip│
│ [👥 Zusammen 3 × 640 KB = 1,9 MB (erlaubt: höchstens 10 MB) ▬▭▭▭] │

Pro Person unterschiedlich
│ DATEIEN JE PERSON                              Alle entfernen│
│ ●  Studentin Drei     (🗜 starter.zip 640 KB) Ersetzen  ×   │
│ ○  Student Zwei       Keine Datei        [Datei auswählen]  │
```
Beschreibung aufgeklappt (die Schaltfläche heißt dann „Beschreibung ausblenden ⌃“, der Rest der Karte rückt nach unten):
```
│ [🗜]  Starter-Projekt                           OPTIONAL │
│       Beschreibung ausblenden ⌃                           │
│       Sie können jeder Person ein Startprojekt mitgeben:  │
│       eine ZIP-Datei, die master.tex im Hauptordner       │
│       enthält. Ohne Datei startet der Editor mit dem      │
│       Demo-Projekt.                                       │
```
Je Team (statt je Person): die Zeile zeigt den Teamnamen und darunter die Mitglieder („Team Alpha / Studentin Drei, Student Zwei“). Ab mehr als 5 Empfängern zeigt die Leiste im Modus „für alle“ drei Zeilen und „9 weitere Personen anzeigen“.
Mobil (≤ 640 px): Chips unter den Titel, Wahlschalter in voller Breite, Datei und Aktionen unter dem Namen, Punkt bleibt am Namen. Kein horizontales Scrollen (bei 375 px geprüft).

## 6. Zustände

| Zustand | Was der Dozent sieht |
|---|---|
| Beschreibung zu (Standard) | Titel, darunter die Schaltfläche „Beschreibung anzeigen ⌄“; der Text ist nicht erreichbar (`inert`) |
| Beschreibung auf | Der Text der App steht unter dem Titel, die Schaltfläche heißt „Beschreibung ausblenden ⌃“, der Fokus bleibt auf ihr |
| Die App liefert keine Beschreibung | keine Schaltfläche; nur die kurze Zeile „Eine ZIP-Datei.“ |
| Leer | Ablagefläche, Hinweis „Optional · gilt für alle 3 Studierenden“ (keine Größenangabe), Leiste mit leeren Ringen |
| Datei darüber ziehen | Ablagefläche in `primaryFaint`, roter gestrichelter Rand, Icon hebt sich |
| Datei da | Datei-Karte (Name, Größe, „gilt für …“, Ersetzen, Entfernen), Punkte füllen sich, Summenzeile |
| Gemischt (Dateien je Person verschieden, Wahl „für alle“) | Hinweis „Die Dateien sind je Person unterschiedlich. Eine neue Datei ersetzt sie alle.“ und die Ablagefläche |
| Pro Person | Zeile je Person: Chip mit Name und Größe, Ersetzen, ×; oder „Keine Datei“ und „Datei auswählen“; jede Zeile nimmt auch Ablegen an |
| Fehler: falsche Endung | „„beispiel.pdf“ ist keine ZIP-Datei. Wählen Sie eine Datei mit der Endung .zip.“ |
| Fehler: Datei zu groß | „„gross.zip“ ist zu groß. Verkleinern Sie die Datei oder wählen Sie eine andere.“ (nennt die Grenze nicht) |
| Fehler: zusammen zu groß | „12 Personen × 880 KB = 10,3 MB. Zusammen sind höchstens 10 MB erlaubt. Nehmen Sie eine Datei bis 853 KB oder laden Sie die Datei nur für einzelne Personen hoch.“ |
| Keine Teams | ruhiger Hinweis in der Karte (heute: gelber Kasten „Noch keine Teams konfiguriert“), keine Ablagefläche |
| Gültigkeit „alle“ (eine Datei für die ganze Bereitstellung) | nur Ablagefläche beziehungsweise Datei-Karte, ohne Wahl und Leiste |

Fehler erscheinen über der Ablagefläche (`role="alert"`, mit Schließen-Knopf) in `danger`/`dangerTint`; die bisherige Auswahl bleibt unverändert.

## 7. Texte
Sie-Form, Verben statt Systembegriffen. Alle neu unter `deployment.fileVariable.*` (de und en).

| Stelle | Heute | Vorschlag |
|---|---|---|
| Titel | `starter` | **Starter-Projekt** (Label der App); ohne Label: „Starter“ aus dem Namen |
| Beschreibung der App | – | hinter der Schaltfläche **Beschreibung anzeigen** / **Beschreibung ausblenden**; standardmäßig zu |
| Zeile ohne Beschreibung | – | „Eine ZIP-Datei.“ (ohne Schaltfläche) |
| Schilder | STRING · Pro Team | **Optional** (die Endung steht schon in „ZIP-Datei hier ablegen“ und im Fehlertext, ein eigenes Schild ist doppelt) |
| Erklärkasten | Pro Team ein eigener Wert … Eingabe pro Team | Wahl „Eine Datei für alle“ / „Pro Person unterschiedlich“ (bzw. „Pro Team unterschiedlich“) mit einem Satz darunter |
| Ablagefläche | Team #1: Datei wählen oder hier ablegen · max. 2 MB | ZIP-Datei hier ablegen · Optional · gilt für alle 3 Studierenden · [Datei auswählen] (keine Größengrenze im Text) |
| Empfänger | Team #1, #2, #3 | Namen der Personen (bei Teams: Teamname und Mitglieder) |
| Aktionen | Entfernen | Ersetzen · Entfernen · Alle entfernen · 9 weitere Personen anzeigen |
| Fehler | Datei zu groß (max. 2 MB). | drei konkrete Meldungen (Abschnitt 6); die Meldung zur Dateigröße nennt keine Zahl |
| Summe | – | Zusammen 3 × 640 KB = 1,9 MB (erlaubt: höchstens 10 MB) |

**Ansprache: durchgehend Sie.** Alle neuen Texte sprechen den Dozenten mit Sie an („Wählen Sie eine Datei …“, „laden Sie die Datei nur für einzelne Personen hoch“, „Sie können jeder Person ein Startprojekt mitgeben“) oder sind neutral formuliert (Schaltflächen im Infinitiv: „Datei auswählen“, „Ersetzen“, „Beschreibung anzeigen“). Das gilt auch für die Beschreibungen, die im Mockup stehen. Der Rückfall-Test `tests/unit/i18n/sie-form.spec.ts` (aus frontend#52) prüft die neuen Schlüssel `deployment.fileVariable.*` automatisch mit: keine Du-Formen, keine Du-Imperative („Wähle“, „Lade“ …). **Die Beschreibung selbst schreibt der App-Autor** (heute als Kommentar in der `appstore.yaml`); wenn sie später über den Vertrag kommt, gehört „in Sie-Form schreiben“ in die Autoren-Vorgabe der Registry. Der Test kann sie nicht prüfen, weil sie nicht in `de.ts` steht.

## 8. Bewegung und Barrierefreiheit
- **Bewegung:** Die Beschreibung klappt in 300 ms auf und zu (Höhe über `grid-template-rows`, Pfeil dreht sich), die Datei-Karte schiebt sich 250 ms ein, die Punkte füllen sich im Abstand von 40 ms (höchstens 12 Stufen), Summenbalken 300 ms. Mit `prefers-reduced-motion` nahezu 0 ms.
- **Beschreibung** ist ein Disclosure: `button` mit `aria-expanded` und `aria-controls`, der Text ist zugeklappt `inert` und `visibility:hidden` (kein Tab-Stopp im Verborgenen), Enter und Leertaste schalten um, der Fokus bleibt auf der Schaltfläche.
- **Wahl** ist eine `radiogroup` (Pfeiltasten wechseln), jede Option ein `radio`.
- **Ablegen** ist nie die einzige Möglichkeit: „Datei auswählen“ ist eine echte Schaltfläche. Die Ablagefläche hat `aria-describedby` auf die Grenzen.
- **Rückmeldung:** Eine `aria-live`-Zeile sagt „starter.zip gilt jetzt für alle 3 Studierenden.“ bzw. nennt den Fehler; Fehlerkasten `role="alert"`.
- **Fokus:** sichtbar (2 px Rot), nach „Entfernen“ zurück auf „Datei auswählen“. Aktionen mit mindestens 32 px Trefferfläche.
- **Farbe allein trägt nichts:** jede Zeile sagt „Keine Datei“ oder nennt die Datei.

## 9. Umsetzung im Frontend
**Neue Dateien** unter `src/views/new-deployment/`:
| Datei | Aufgabe |
|---|---|
| `FileVariableCard.tsx` | Karte für eine Datei-Variable; ersetzt den `isFileVar`-Zweig in `VariableCard.tsx` und deckt die Gültigkeiten `all`, `team`, `user` ab; enthält das Auf-/Zuklappen der Beschreibung (lokaler Zustand, standardmäßig zu; gleiche Technik wie `VmExpertSettings`) |
| `FileDropArea.tsx` | zugängliche Ablagefläche mit Dateidialog, prüft Endung, Größe, Gesamtgröße **auch beim Ablegen** |
| `FileRecipients.tsx` | die Leiste (Punkte, Zeilen, „weitere anzeigen“) |
| `fileLimits.ts` | `FILE_MAX_BYTES` (1 MiB, wenn die App nichts sagt; nur zum stillen Prüfen, nie angezeigt), `DEPLOYMENT_FILES_MAX_BYTES` (10 MiB), `validateUpload(...)` mit Fehlercodes `type`, `size`, `total`, `formatFileSize` (deutsches Komma) |
| `FileVariableCard.css` | Leiste und Animationen (nur Tokens) |

- **Daten:** unverändert `draft.fileUploads[varName][slot]` (`setFileSlot`/`getFileSlot` in `useVariableForm`). „Eine Datei für alle“ schreibt dieselbe Nutzlast in alle Slots; der Zustand „für alle“ wird abgeleitet (alle Slots gleich, verglichen über Name, Größe und Inhalt), er ist kein neues Feld im Store.
- **Namen:** `buildWizardTeams` liefert bisher nur `username`. Es bekommt zusätzlich einen Anzeigenamen (Vor- und Nachname aus `studentCache`), Rückfall `username`.
- **Backend-Vertrag (optional, besser):** `label`, `description` und `maxSize` je Variable in `appstore.yaml` und in `GET /apps/{id}/variables`. Dann zeigt die Karte „Starter-Projekt“ statt des Rückfalls, und `maxSize` ersetzt die feste 1 MB der stillen Prüfung (angezeigt wird die Grenze nicht). Das berührt Backend (`app/k8s/spec.py` `Variable` ist `extra="forbid"`, `spec_variables`), den Registry-Validator und die beiden App-Repos. Die Oberfläche funktioniert ohne diese Änderung (Rückfall: aus dem Namen abgeleiteter Titel, stille Prüfung mit 1 MB).
- **Nebenbei behoben:** „max. 2 MB“ und die fehlende Endungsprüfung beim Ablegen (Befund 1 und 2).

**Tests zusätzlich:** Prüfung Endung / Größe / Gesamtgröße (auch beim Ablegen), Meldungen im Wortlaut der Tabelle, „für alle“ schreibt alle Slots und zeigt „gilt für alle n“, Wechsel zu „Pro Person“ behält die Dateien, Ersetzen/Entfernen je Zeile, Leiste mit mehr als 5 Empfängern, Teams mit Mitgliedern, Gültigkeit `all` ohne Wahl und Leiste, Rückfalltitel ohne Label, Radiogroup per Tastatur, `aria-live`; **Beschreibung:** standardmäßig zu (`aria-expanded="false"`, Text `inert`), Klick sowie Enter und Leertaste klappen auf und zu (Beschriftung wechselt zwischen „anzeigen“ und „ausblenden“), ohne Beschreibung der App gibt es keine Schaltfläche, sondern nur die kurze Zeile.

## 10. Entscheidungen für Sie
1. **Backend-Vertrag erweitern** (`label`, `description`, `maxSize`)? Ohne ihn heißt die Karte „Starter“ und „Assignments“ (aus dem Namen abgeleitet) und die stille Prüfung nimmt fest 1 MB. Mit ihm braucht es Änderungen in Backend, Registry und beiden App-Repos.
2. **Standard „Eine Datei für alle“** und „Pro Person unterschiedlich“ als bewusste Ausnahme: einverstanden?
3. **Anzeigename der Studierenden** (Vor- und Nachname) statt Benutzername: ist der Name im Wizard überall verfügbar, wo Sie ihn brauchen?
4. **Beschreibung standardmäßig zugeklappt** (meine Empfehlung: Titel, Schilder und Ablagefläche sagen schon, worum es geht; wer mehr wissen will, klappt auf). Die Alternative ist aufgeklappt beim ersten Besuch. Soll der Zustand je Variable gemerkt werden (zum Beispiel für die Sitzung)? Ich würde das nicht tun, solange die Beschreibung kurz bleibt.
5. **Zusammen-Grenze von 10 MB** in der Oberfläche prüfen (heute erst im Backend): ja? Der Wert steht dann an zwei Stellen und muss mit dem Backend synchron bleiben.

## 11. Beobachtungen außerhalb dieses Designs
- Der Kopf „App-Einstellungen“ ist noch lila, und die Karten für Text und Auswahl-Variablen haben dieselbe lila Sprache. Sie sollten später dieselbe Karte bekommen (gleiche Kopfzeile, Chips, Rot).
- `FileDropZone` wird auch von `VariableInput` benutzt; dort greift die Endungsprüfung ebenfalls nicht.
- Der grüne Weiter-Button passt weiter nicht zum roten Theming (wie beim Windows-Design angemerkt).
