# Design-Plan: Zusammenfassung (Wizard-Schritt 4, „Übersicht“)

Zu [frontend#136](https://github.com/DHBW-AppStore-T3/frontend/issues/136).
Mockup: [`mockup/index.html`](mockup/index.html), interaktiv (Schalter „Heute / Neu“, App, Zuordnung, Werte, Laden; „Bearbeiten“ und „Deployen“ reagieren). Gleiche Designsprache wie [frontend#109](https://github.com/DHBW-AppStore-T3/frontend/issues/109) (Windows-VM) und [frontend#113](https://github.com/DHBW-AppStore-T3/frontend/issues/113) (Datei-Variablen).

Bilder: [`0-ist-zustand`](screenshots/0-ist-zustand.png), [`1-heute-web-latex-nachgebaut`](screenshots/1-heute-web-latex-nachgebaut.png), [`2-neu-pgadmin-ohne-variablen`](screenshots/2-neu-pgadmin-ohne-variablen.png), [`3-neu-web-latex-ohne-datei`](screenshots/3-neu-web-latex-ohne-datei.png), [`4-neu-web-latex-mit-datei`](screenshots/4-neu-web-latex-mit-datei.png), [`5-neu-windows-vm-standard`](screenshots/5-neu-windows-vm-standard.png), [`6-neu-windows-vm-angepasst`](screenshots/6-neu-windows-vm-angepasst.png), [`7-neu-teams-und-text-variablen`](screenshots/7-neu-teams-und-text-variablen.png), [`8-neu-laedt`](screenshots/8-neu-laedt.png), [`9-neu-mobil`](screenshots/9-neu-mobil.png).

## 1. Worum es geht
- **Nutzer:** nicht technischer Dozent, kurz vor dem Klick auf „Deployen“.
- **Aufgabe der Seite:** vor dem Start prüfen: Was starte ich, für wen, mit welchen Einstellungen? Ein Fehler ist danach teuer (Umgebungen laufen, Studierende arbeiten darin).
- **Vorgabe von Ihnen:** gleiches ansprechendes Design wie die anderen Mockups; „Variablen-Konfiguration“ nur zeigen, wenn die App Variablen zu konfigurieren hat. Das ist von App zu App verschieden.

## 2. Befund (Screenshot, Code `NewDeploymentSummaryView.tsx`, `summary.ts`)

| # | Befund | Folge |
|---|---|---|
| 1 | Drei große Pastellkästen in Grün, Blau, Lila, dazu Amber (Dateien) und rote Kreise | Ein Regenbogen statt der roten T3-Sprache der anderen Schritte; die Farben bedeuten nichts |
| 2 | Die Nummern 1, 2, 3 stehen vor den Blöcken | Sie sagen nichts, was der Fortschrittsbalken nicht schon sagt (und Block 3 ist Schritt 3, Block 1 sind Schritte 1 und 2) |
| 3 | Block 3 „Variablen-Konfiguration“ ist **immer** da: bei Web-LaTeX mit „App-Einstellungen 0 · Diese App hat keine Einstellungen.“, bei pgAdmin ebenso | Eine leere Karte, die Aufmerksamkeit kostet. **Das ist Ihr Punkt.** |
| 4 | Die Studierenden stehen zweimal da: als Chips in Block 1 und noch einmal in Kästen „Team #1, #2, #3“ in Block 2 | Bei „Jeder Nutzer einzeln“ sind das drei Kästen mit je einem Namen |
| 5 | Die **gewählte Rechenleistung** (vCPU, RAM der Windows-VM) kommt auf der Seite gar nicht vor (`draft.resources` wird nicht gezeigt) | Der Dozent bestätigt etwas, das er nicht mehr sieht |
| 6 | Netzwerk steht nur, wenn es vom Standard **abweicht** (`networkDeviations`), und im Block „Basis“ | Der Internetzugriff ist seit #109 eine eigene, immer sichtbare Entscheidung, in der Übersicht fehlt sie im Standardfall |
| 7 | Dateien: „starter (Bereich: team)“, „Keine Datei hochgeladen“ | Technische Namen (`starter`, „Bereich“), kein Hinweis, für wen die Datei gilt |
| 8 | Titel „Empfohlene Konfiguration“ | Es ist nicht die empfohlene, sondern **Ihre** Konfiguration |
| 9 | „Bearbeiten“ gibt es nur für Variablen | Name, Auswahl und Verteilung lassen sich nur über „Zurück“ Schritt für Schritt erreichen |
| 10 | Laden: ein Spinner mit „Lade Konfiguration...“ | Die Seite springt, wenn der Inhalt kommt |

## 3. Welche Apps liefern was (geprüft am 2026-10-26/27, Staging und `appstore.yaml`)

| Typ | Apps | Hat Variablen zu konfigurieren? | Neue Seite |
|---|---|---|---|
| A: nichts einzustellen | pgAdmin, template-app, Jupyter-Notebook, java-ide („Kommunikationssysteme“), Ubuntu-App | nein | **Zwei Karten**: Das wird gestartet, Teilnehmende. Keine Variablen-Konfiguration. |
| B: Datei-Variable | Web-LaTeX (`starter`), Online-IDE (`assignments`) | ja, eine optionale Datei | Drei Karten; Zeile „Starter-Projekt“ / „Aufgaben“ |
| C: Windows-VM | windows-matlab-app v2.1.0 | ja: Rechenleistung, Internetzugriff, Vernetzte Desktops | Drei Karten mit bis zu drei Zeilen |
| D: Text-/Auswahl-Variablen | heute keine App, der Code kann es (`buildTerraformEntries`) | ja | Drei Karten; je Variable eine Zeile |

## 4. Review des ersten Entwurfs
Der erste Gedanke: dieselben drei Kästen, nur in Weiß mit rotem Rand und rotem Nummernkreis, leere Karte ausblenden. Das ist ein Farbwechsel, keine neue Seite. Er löst weder 4, 5, 6 noch den Zweck (kurz vor dem Start prüfen).

| Verworfen | Warum | Stattdessen |
|---|---|---|
| Nummerierte Blöcke 1/2/3 | Keine Information; die Nummern stimmen nicht mit den Schritten überein | Jede Karte führt über „Bearbeiten“ zu ihrem Schritt (Auswahl, Verteilung, Variablen) |
| Vier Kacheln „Name / App / Version / Laufzeit“ | Datenfelder ohne Aussage, jede gleich laut | **Ein Satz** als Thesis der Seite („Web-LaTeX für 3 Personen“), Name darunter, Version und Laufzeit als Typenschild |
| Studierende als Chips **und** als Teamkästen | Doppelt, bei „Je Person“ sinnlos | Eine Leiste (wie bei den Datei-Variablen): bei „Je Person“ die Personen, sonst die Teams mit ihren Mitgliedern |
| Karte „Variablen-Konfiguration“ immer zeigen | Leere Karte (Befund 3) | Nur zeigen, wenn mindestens eine Zeile existiert (Abschnitt 6) |
| Netzwerk nur bei Abweichung | Der Dozent sieht den Standard „Internet erlaubt“ nicht | Das **Ergebnis** der Entscheidung zeigen, mit Folgezeile wie in Schritt 3 |

**Signatur (der eine gewagte Punkt):** *Der Satz.* Die Seite beginnt mit dem, was der Klick auslöst: „windows-matlab-app für 3 Personen“. Alles darunter belegt diesen Satz. Der Rest bleibt ruhig: weiße Karten, rote Bedienung.

## 5. Designsystem
Dieselben Tokens wie in #109 und #113 (`src/theme/themes/t3.ts`), nichts Neues:

| Rolle | Token | Einsatz |
|---|---|---|
| DHBW-Rot | `primary` | „Deployen“, Punkte der Leiste, „Bearbeiten“-Links, geänderte Zahlen |
| Rot dunkel / tief | `primaryDark` / `primaryDeep` | Linktext / Status „Erlaubt“, Chip „Angepasst“, Icons |
| Rosé | `primaryFaint` / `primarySoft` | Icon-Flächen, Status-Pillen, Datei-Karte, Linie der Leiste |
| Tinte / Schiefer | `textHeading` / `textStrong` | Titel, Zahlen / Hilfetexte |
| Flächen und Linie | `surface`, `surfacePage`, `surfaceMuted`, `borderSubtle` | Karte, Typenschild, Chips, Trennlinien |

**Kontrast:** unverändert wie in #109/#113 (`textMuted` nur für Deko; `primaryDeep` auf `primaryFaint` 8,0:1; `textStrong` auf `surfaceMuted` 12,2:1).
**Typografie:** Inter, `tabular-nums` für Zahlen. Satz der Seite `text-2xl font-extrabold tracking-tight` (26 px; mobil 22 px, mit `text-wrap: balance`), Kartentitel `text-base font-bold`, Mikro-Labels `text-xs font-bold uppercase tracking-wider`.
**Form:** Karten `rounded-xl`, Icon-Fläche `rounded-lg`, Pillen und Chips `rounded-full`, Schatten `shadow-sm`. Spalte `max-w-3xl` (720 px) wie bei den anderen Schritten.
**Farbe weg:** Grün, Blau, Lila, Amber und die roten Nummernkreise entfallen komplett.

## 6. Layout und Sichtbarkeitsregeln

```
┌──────────────────────────────────────────────────────────┐
│ [▭]  DAS WIRD GESTARTET                      ✎ Bearbeiten │
│      windows-matlab-app für 3 Personen                    │
│      Deployment „test“                                    │
│      ┌────────────┬──────────────────┐                    │
│      │ VERSION    │ LAUFZEIT         │                    │
│      │ v2.1.0     │ VM im Cluster    │                    │
│      └────────────┴──────────────────┘                    │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ [👥] Teilnehmende  (JEDER NUTZER EINZELN)    ✎ Bearbeiten │
│      Jede Person bekommt einen eigenen Windows-Desktop.   │
│      ●  Studentin Drei                                    │
│      │                                                    │
│      ●  Student Zwei                                      │
│      ●  Student Vier                                      │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐   ← nur, wenn es Zeilen gibt
│ [≡]  Variablen-Konfiguration                 ✎ Bearbeiten │
│ ──────────────────────────────────────────────────────── │
│ Rechenressourcen   [6 VCPU | 12 GB RAM] ● ANGEPASST       │
│                    je Desktop · insgesamt für 3 Personen: │
│                    18 vCPU · 36 GB RAM                    │
│ ──────────────────────────────────────────────────────── │
│ Internetzugriff    ● GESPERRT                             │
│                    🔒 Studierende arbeiten ohne Internet… │
│ ──────────────────────────────────────────────────────── │
│ Vernetzte Desktops ● AN                                   │
└──────────────────────────────────────────────────────────┘
                              ← Zurück          [ Deployen ]
```

**Wann erscheint was** (die Antwort auf Ihre Vorgabe):

| Block / Zeile | Sichtbar, wenn … | Quelle im Code |
|---|---|---|
| Das wird gestartet | immer | `draft.name`, App, `draft.releaseTag`, `draft.runtime`, `draft.studentIds.length` |
| Teilnehmende | immer | `draft.groupMode`, `draft.groupNames`, `draft.assignments`, `draft.groupCount` |
| **Variablen-Konfiguration (Karte)** | **mindestens eine der folgenden Zeilen existiert** | Summe der Zeilen unten |
| ↳ Rechenressourcen | die App eine Ressourcen-Auswahl anbietet | `draft.resourceChoices.length > 0` |
| ↳ Internetzugriff | die App ihn freigibt | `visibleNetworkKeys(draft)` enthält `internet` |
| ↳ Vernetzte Desktops / Pods | freigegeben **und** mindestens 2 Workloads | `visibleNetworkKeys(draft)` enthält `podNetwork` |
| ↳ je Datei-Variable eine Zeile | die App eine Datei-Variable hat (auch ohne gewählte Datei: „Keine Datei ausgewählt.“) | `buildFileSummaries(defs, uploads)` |
| ↳ je Text-/Auswahl-Variable eine Zeile | die App solche Variablen hat | `buildTerraformEntries(defs, variables)` |

Ergebnis je Typ aus Abschnitt 3: A zwei Karten, B drei Karten mit einer Zeile, C drei Karten mit drei Zeilen (bei einer einzigen Person ohne „Vernetzte Desktops“), D drei Karten.

## 7. Bausteine im Detail

### Das wird gestartet
- Satz: `{App} für {n} Personen` (bei 1: „für 1 Person“). Darunter `Deployment „{Name}“`.
- Typenschild mit zwei Zellen: Version, Laufzeit (`runtimeLabelKey`). Mobil untereinander, Wert rechts.
- „Bearbeiten“ → Schritt „Auswahl“ (Name und Studierende).
- App-Bild: heute lädt die Seite `selectedApp.image`; das Mockup nutzt ein Symbol je App. Mit Bild: das Bild in die Icon-Fläche (40 px, `rounded-lg`), sonst das Symbol (`Package`).

### Teilnehmende
- Chip mit dem Modus (die heutigen Namen: „Jeder Nutzer einzeln“, „Eine Gruppe“, „Individuell“) und ein Satz, was das bedeutet:
  - Je Person: „Jede Person bekommt {eine eigene Umgebung | einen eigenen Windows-Desktop}.“
  - Eine Gruppe: „Alle arbeiten gemeinsam in {einer Umgebung | einem Windows-Desktop}.“
  - Individuell: „Jedes Team bekommt … Das sind 2 Umgebungen für 3 Personen.“
- Leiste (Punkt je Umgebung): bei „Je Person“ nur Namen; sonst Teamname, darunter die Mitglieder, rechts „2 Personen“. Die Namen kommen wie bisher aus `studentCache`/`displayNameOf`.
- „Bearbeiten“ → Schritt „Verteilung“.

### Variablen-Konfiguration
- Definitionsliste (`<dl>`): links die Bezeichnung (`font-semibold`), rechts der Wert. Mobil untereinander.
- **Rechenressourcen:** Typenschild „6 vCPU | 12 GB RAM“ wie in Schritt 3, Chip „Empfohlen“ oder „● Angepasst“, darunter „je Desktop · insgesamt für 3 Personen: 18 vCPU · 36 GB RAM“ (nur bei einer VM pro Person; Hilfen `isDefaultSelection`, `totalResources`, `formatMemoryGb` gibt es seit #109).
- **Internetzugriff:** Pille „Erlaubt“ (rosé) oder „Gesperrt“ (grau) und die Folgezeile aus Schritt 3 („Studierende können Server im Internet erreichen.“ mit Warnsymbol, bzw. „… arbeiten ohne Internetzugriff.“ mit Schloss).
- **Vernetzte Desktops / Pods:** Pille „An“ / „Aus“ mit einem Satz.
- **Datei:** Titel der Variable (wie in #113: `label`, sonst aus dem Namen), Datei-Karte „starter.zip · 640 KB · gilt für alle 3 Personen“ oder „Keine Datei ausgewählt.“; bei verschiedenen Dateien je Person „3 Dateien · 1,9 MB“ mit der Leiste darunter.
- **Text-/Auswahl-Variable:** Titel, Wert; bei Werten je Team eine Zeile je Team.
- „Bearbeiten“ → Schritt „Variablen“.

### Deployen
Rote Fläche, die einzige im Seitenkörper. Beim Senden „Wird erstellt …“ mit Spinner, der Knopf ist gesperrt. Fehler beim Senden bleiben wie heute Toasts (`formatSubmitError`), nicht Teil dieses Designs.

## 8. Zustände

| Zustand | Was der Dozent sieht |
|---|---|
| Lädt (Definitionen werden geholt) | drei Skelettkarten statt Spinner; `aria-busy`, „Lade Konfiguration …“ für Screenreader. „Deployen“ gesperrt. |
| App ohne Variablen (Typ A) | zwei Karten, kein Hinweis auf „keine Einstellungen“ |
| Datei optional, keine gewählt | Zeile mit „Keine Datei ausgewählt.“ |
| Eine einzige Person | „… für 1 Person“; keine Zeile „Vernetzte Desktops“ |
| App nicht gefunden (`selectedApp` fehlt) | wie heute der Hinweis `appNotFound`, im Satz statt des App-Namens |
| Senden | „Wird erstellt …“, Knöpfe gesperrt |

## 9. Texte (Sie-Form, `deployment.summary.*`)

| Stelle | Heute | Neu |
|---|---|---|
| Titel | Empfohlene Konfiguration | Zusammenfassung |
| Untertitel | Überprüfen Sie alle Einstellungen vor dem Start | Prüfen Sie die Angaben, bevor Sie das Deployment starten. |
| Block 1 | Basis-Konfiguration · Deployment Name · App · Version · Laufzeit · Ausgewählte Studenten (3) | Das wird gestartet · „{App} für {count} Personen“ · Deployment „{Name}“ · Version · Laufzeit |
| Block 2 | Team-Zuweisung · Anzahl Teams · Modus · Team #1 … | Teilnehmende · Chip mit dem Modus · ein Satz · Leiste |
| Block 3 | Variablen-Konfiguration (immer) · App-Einstellungen (0) · Diese App hat keine Einstellungen. · Hochgeladene Dateien | Variablen-Konfiguration (nur mit Zeilen) · eine Zeile je Einstellung |
| Datei | starter (Bereich: team) · Keine Datei hochgeladen | Starter-Projekt · Keine Datei ausgewählt. / starter.zip · 640 KB · gilt für alle 3 Personen |
| Netzwerk | Experteneinstellungen: Internetzugriff: An (nur bei Abweichung) | Internetzugriff · Erlaubt / Gesperrt · Folgezeile (immer, wenn freigegeben) |
| Knöpfe | Bearbeiten (nur Block 3) · Zurück · Deployen | Bearbeiten (je Karte, mit `aria-label` „Name und Auswahl / Verteilung / Variablen bearbeiten“) · Zurück · Deployen |
| Senden | Wird erstellt... | Wird erstellt … |

Wiederverwendet werden: `deployment.vm.expert.recommended/changed`, `deployment.vm.internet.*`, `deployment.vm.pods.label`, `deployment.vm.resources.totalLabel`, `deployment.network.*` für Pod-Apps, die Namen der Verteilungsmodi (`deployment.groups.*`). Neue Schlüssel: Satz „{App} für {count} Personen“ (Singular und Plural), Eyebrow „Das wird gestartet“, drei Modussätze (je Person / Gruppe / Team, je für Umgebung und Desktop), „Keine Datei ausgewählt.“, die `aria-label`s. Der Sie-Form-Test (`tests/unit/i18n/sie-form.spec.ts`) prüft sie mit.

## 10. Bewegung und Barrierefreiheit
- **Bewegung:** nur Skelett (Schimmern, mit `prefers-reduced-motion` aus) und Spinner beim Senden. Sonst keine.
- **Struktur:** jede Karte ist eine `<section>` mit `aria-labelledby` auf ihren Titel; Zeilen der Konfiguration sind eine `<dl>`; die Leiste eine `<ol>`.
- **„Bearbeiten“:** mobil nur das Stiftsymbol (32 px Trefferfläche), der Text bleibt für Screenreader (`aria-label` nennt das Ziel).
- **Farbe allein trägt nichts:** jeder Zustand steht auch als Text („Erlaubt“, „Angepasst“, „Keine Datei ausgewählt.“).
- **Fokus:** sichtbar (2 px Rot); „Deployen“ behält beim Senden den Fokus (gesperrt, `aria-busy`).
- **Mobil (375 px):** Karten füllen die Breite, die Titelzeile von „Das wird gestartet“ ist Symbol, Eyebrow und Stift, der Satz steht darunter in voller Breite; Konfigurationszeilen stehen untereinander. Kein horizontales Scrollen (im Mockup in 375 px geprüft).

## 11. Umsetzung im Frontend

**Neue Dateien** unter `src/views/new-deployment/`:

| Datei | Aufgabe |
|---|---|
| `SummaryHero.tsx` | Karte „Das wird gestartet“ (Satz, Name, Typenschild) |
| `SummaryParticipants.tsx` | Karte „Teilnehmende“ mit Modus-Chip, Satz und Leiste |
| `SummarySettings.tsx` | Karte „Variablen-Konfiguration“ mit `<dl>`; rendert `null` ohne Zeilen |
| `summaryRows.ts` | reine Funktion `buildSettingsRows(draft, defs, ctx)` → Zeilen (`resources`, `network`, `file`, `value`); leere Liste = keine Karte. Bündelt die Regeln aus Abschnitt 6 |
| `RecipientRail.tsx` (+ `.css`) | die Leiste aus #113 (`FileRecipients`) als gemeinsame Komponente: Zeilen, Punkte, Teilnamen; Datei-Karte und Übersicht nutzen sie |

`NewDeploymentSummaryView.tsx` schrumpft auf: Daten holen (`useSummaryVariables`, `useSubmitDeployment`), die drei Karten, Zurück und Deployen. `summary.ts` behält Fehlertexte und `buildFileSummaries`/`buildTerraformEntries`; `buildFileSummaries` liefert zusätzlich `label` und „gleiche Datei für alle“. Der lokale `VariableCard` der Datei entfällt.

**Tests:**
- `summaryRows.test.ts`: je Typ aus Abschnitt 3 die richtigen Zeilen (A leer, B eine Datei-Zeile auch ohne Datei, C bis zu drei Zeilen, ohne „Vernetzte“ bei einer Person, D je Variable eine Zeile); Reihenfolge; „Angepasst“/„Empfohlen“; Summe.
- `SummarySettings`: rendert nichts ohne Zeilen.
- `NewDeploymentSummaryView.spec.tsx`: Karte „Variablen-Konfiguration“ fehlt bei pgAdmin-artigem Draft, ist da bei Datei-, VM- und Text-Variablen; Internetzugriff steht auch im Standardfall; Rechenleistung steht; „Bearbeiten“ je Karte navigiert zu `paths.deploymentConfig`, `deploymentTeams`, `deploymentVariables`; Deployen sperrt beim Senden. **Zu ändern:** die Fälle „zeigt nur die vom Default abweichende Einstellung“ und „zeigt nichts, wenn alles dem Default entspricht“ (Entscheidung 1).
- Regression: Pod-Apps ohne Auswahl zeigen **keine** Netzwerk- oder Ressourcenzeile.
- i18n-Parität und Sie-Form für die neuen Schlüssel.

## 12. Entscheidungen für Sie
1. **Netzwerk immer zeigen?** Meine Empfehlung: ja (das Ergebnis der Entscheidung statt nur der Abweichung). Dann ändern sich zwei bestehende Tests. Die Alternative ist, wie heute nur Abweichungen zu nennen.
2. **Titel „Zusammenfassung“** statt „Empfohlene Konfiguration“?
3. **Der Satz „{App} für {n} Personen“** als Kopf: einverstanden? Er zeigt bei Windows den technischen App-Namen `windows-matlab-app`; ein lesbarer Anzeigename müsste aus dem Katalog kommen.
4. **Optionale Datei ohne Auswahl:** Karte „Variablen-Konfiguration“ mit „Keine Datei ausgewählt.“ zeigen (meine Empfehlung, weil die App eine Variable anbietet) oder gar keine Karte?
5. **„Bearbeiten“ je Karte:** Das Ziel sind die Schritte Auswahl, Verteilung, Variablen. Ich habe nicht geprüft, ob der Wizard-Zustand beim Zurückspringen in Schritt 1 (Studierende ändern) die Verteilung zurücksetzt; das wäre vor der Umsetzung zu testen.

## 13. Beobachtungen außerhalb dieser Seite
- **Schritt 3 „Variablen“** zeigt bei Apps ohne Variablen (Typ A) nur „Diese App benötigt keine speziellen Variablen.“. Dieselbe Regel könnte den ganzen Schritt überspringen, dann wäre auch der Fortschrittsbalken kürzer. Das ist ein eigenes Thema.
- Der grüne „Weiter“-Button der Schritte 1 bis 3 passt weiter nicht zum roten Theming; „Deployen“ ist rot.
