# Design-Plan: Startseite (Dashboard) je Rolle

Zu [frontend#138](https://github.com/DHBW-AppStore-T3/frontend/issues/138).
Mockup: [`mockup/index.html`](mockup/index.html), interaktiv (Schalter „Rolle“ und „Zustand“ in der dunklen Leiste; Deep-Links siehe unten).

Bilder: [`0-ist-zustand`](screenshots/0-ist-zustand.png), [`1-neu-lehrende`](screenshots/1-neu-lehrende.png), [`2-neu-lehrende-leer`](screenshots/2-neu-lehrende-leer.png), [`3-neu-admin`](screenshots/3-neu-admin.png), [`4-neu-admin-leer`](screenshots/4-neu-admin-leer.png), [`5-neu-studierende`](screenshots/5-neu-studierende.png), [`6-neu-studierende-leer`](screenshots/6-neu-studierende-leer.png), [`7-neu-mobil-lehrende`](screenshots/7-neu-mobil-lehrende.png), [`8-neu-mobil-studierende`](screenshots/8-neu-mobil-studierende.png).

## 1. Worum es geht
- **Nutzer:** drei Rollen mit drei Fragen. Lehrende: „Läuft alles für meine Vorlesung?“ Admin: „Was wartet auf mich?“ Studierende: „Wo komme ich in meine Umgebung?“
- **Aufgabe der Seite:** diese eine Frage beantworten, ohne dass jemand erst eine Liste öffnen muss.
- **Vorgabe:** aktuelle und letzte Deployments auf die Startseite, nach Kurs sortiert; was sinnvoll ist, je nach Rolle.

## 2. Befund (Screenshot, `DashboardView.tsx`, `dashboard.py`)

| # | Befund | Folge |
|---|---|---|
| 1 | Die Seite zeigt drei Zähler (Deployments, Apps, Kurse) und sonst nichts; keine einzige Zeile mit Inhalt | Wer wissen will, ob ein Deployment läuft, muss in die Liste |
| 2 | Alle Rollen sehen dasselbe; nur die Kurse-Kachel fehlt bei Studierenden | Studierende sehen „Apps 12“ (Katalogzähler), aber nicht eines ihrer Deployments |
| 3 | „10 Deployments“ zählt alle nicht gelöschten, die Liste öffnet im Tab „Aktiv“ (`DeploymentsListView`: `useState('active')`) | Die Zahl passt nicht zum Klickziel |
| 4 | „Kurse 3“ ist die Zahl **aller** Kurse (`count(Course)`), auch fremder | Lehrende lesen es als „meine Kurse“ |
| 5 | Admins sehen bei „Deployments“ nur ihre eigenen (`Deployment.userId == current_user`) | Keine Plattformsicht |
| 6 | Die Hilfe sagt „Prüfen Sie auf dem Dashboard, ob Ihr Kontingent (Quota) ausgeschöpft ist“ | Das Dashboard zeigt kein Kontingent; Reste (`.quota-grid`, `activity`, `appUpdated` …) liegen ungenutzt in CSS und i18n |
| 7 | Ein Deployment hat **keinen Kurs** (weder Spalte noch Feld im Response); der Kurs ergibt sich nur über die Mitglieder (`users.courseId`) | „Nach Kurs“ braucht das Backend: `courses[]` am Deployment |
| 8 | `GET /deployments/` liefert Lehrenden und Admins nur eigene Deployments | Für Lehrende reicht das; Admins sehen nur ihre eigenen |

## 3. Review des ersten Entwurfs
Der erste Gedanke: ein roter Banner „2 Deployments sind fehlgeschlagen“ über den Kacheln, darunter zwei Listen („Aktuell“, „Zuletzt“), je Kurs gruppiert. Das sagt dreimal dasselbe, ist doppelt so lang und rot auf DHBW-Rot.

| Verworfen | Warum | Stattdessen |
|---|---|---|
| Roter Alarm-Banner | Doppelt zu Zeilen und Band; Marken-Rot (`primary`) und Fehler-Rot (`danger`) verschwimmen | **Eine Zeile** unter dem Kartentitel nennt die Zahlen; die betroffene Zeile ist getönt |
| Hero-Satz mit Zahlen („6 Deployments laufen …“) anstelle des Standardtexts | Vorgabe: Unter der Begrüßung bleibt „Willkommen zurück in Ihrer Deployment-Umgebung.“ | Der Hero bleibt wie heute; die Zusammenfassung wandert in die Karte |
| Zwei Listen „Aktuell“ und „Zuletzt“ je Kurs | Doppelte Länge, Deployments springen zwischen den Listen | **Eine Liste je Kurs**: aktive zuerst, gestoppte eingeklappt |
| Aktivitätsfeed („Letzte Aktivitäten“) | Das Backend hat kein Ereignisprotokoll; Status und Datum sagen dasselbe | Status-Pille und Datum je Zeile |
| Donut oder Kreisdiagramm je Kurs | Braucht Legende, ist bei 1–5 Deployments leer | **Kurs-Band**: eine Leiste, ein Segment je Deployment-Zustand |
| Kacheln für Studierende (Apps, Kurse) | Studierende können weder Apps deployen noch Kurse verwalten | Die Umgebungen selbst als Karten |
| Eine eigene Seite „Plattform“ für Admins | Zu viel für ein Issue | Karte „Plattform“ (später), Queue zuerst |

**Signatur (der eine gewagte Punkt):** *Das Kurs-Band.* Jeder Kurs trägt unter seinem Namen eine schmale Leiste, deren Segmente die Zustände seiner Deployments zeigen (aktiv, in Bereitstellung, fehlgeschlagen, gestoppt). Die Länge ist die Anzahl, die Farbe der Zustand, jedes Segment ist ein Link in die gefilterte Liste. Man sieht in einer Sekunde, welcher Kurs ein Problem hat. Alles andere bleibt ruhig: weiße Karten, rote Bedienung, kein neues Element.

## 4. Designsystem
Dieselben Tokens wie in den anderen Mockups (`src/theme/themes/t3.ts`), nichts Neues:

| Rolle | Token | Einsatz |
|---|---|---|
| DHBW-Rot `#E2001A` | `primary` | „Neues Deployment“ (die einzige gefüllte Schaltfläche der Seite), Randlinie der Zweitschaltflächen, Links |
| Rot dunkel | `primaryDark` | Textlinks („Alle Deployments“) |
| Rosé | `primaryFaint` | Icon-Fläche der Kachel, App-Kachel in der Queue |
| Tinte / Schiefer | `textHeading` / `textStrong` | Titel, Namen / Meta-Texte (siehe Kontrast) |
| Fläche, Linie, Wash | `surface` (78 %), `borderSubtle`, `surfaceMuted` | Karten (wie `.kpi-item`), Trennlinien, Zähler-Spur |
| Aktiv | `statusGreen` (Segment), `successTint`, grün-800 (Pille) | Zustand „Aktiv“ |
| Bereitstellung | `info` (Segment), `infoTint`, blau-800 (Pille) | Zustand „In Bereitstellung“ |
| Fehler | `danger` (Segment, Zeilenrand), `dangerTint` (Zeile), rot-800 (Pille) | Zustand „Fehlgeschlagen“ |
| Prüfung | `warningTint`, `warning` | Zustand „In Prüfung“, „seit 2 Tagen“ |
| Gestoppt | `statusSlate` (Segment), `surfaceMuted` (Pille) | Zustand „Gestoppt“ |

Die Pillen-Farben sind die aus `deployments-list/helpers.ts` (`statusPillClass`); das Dashboard erfindet keine neuen.

**Kontrast:** `textMuted` hat 4,37:1 und taugt nur für große Schrift. Für Meta-Texte mit 12 px nimmt das Mockup einen dunkleren Schiefer (`#5A6B85`, 5,4:1). Im Code: `text-textStrong/75` (ergibt ca. 6,2:1 auf Weiß), kein neues Token.
**Typografie:** Inter, `tabular-nums` für Zahlen. Hero-Name wie heute (`clamp(34px, 3vw, 50px)`, 750, −.045em); der Text darunter wie heute (19 px, `textMuted`). Kartentitel 16 px/650, Kurs-Name 15 px/650, Zeilenname 14 px/600, Meta 12 px.
**Form:** Karten 12 px (`--workspace-card-radius`, wie `.kpi-item` und `.ui-card`), Pillen `rounded-md` (8 px, wie heute), Band 8 px hoch mit 4 px Rundung an den Enden, 2 px Abstand zwischen den Segmenten.

## 5. Layout und Regeln

```
Lehrende / Admin (Desktop, 1440 px)                          Studierende
┌─────────────────────────────────────────────┐              ┌────────────────────────────────────┐
│ Hallo Dozentin                              │  Hero-Foto   │ Hallo Lena                         │
│ Willkommen zurück in Ihrer Deployment-Umge- │              │ Willkommen zurück in Ihrer …       │
│ bung.                                       │              │ [🎓 Web-Engineering WWI23]          │
├──────────────┬──────────────┬───────────────┤              │ Ihre Umgebungen  3                 │
│ 6 von 11     │ 8            │ 3             │  Kacheln     │ ┌────────┐ ┌────────┐ ┌────────┐   │
│ Aktive Depl. │ Apps         │ Meine Kurse   │              │ │ Aktiv  │ │ In Ber.│ │ Fehlg. │   │
├──────────────┴──────────────┴─┬─────────────┤              │ │ Name   │ │ Name   │ │ Name   │   │
│ Deployments nach Kurs         │ Neues Depl. │              │ │ [Zugang│ │ Details│ │ Details│   │
│ 6 laufen, 1 wird bereitgest…, │ [+ Neues…]  │              │ └────────┘ └────────┘ └────────┘   │
│ 2 sind fehlgeschlagen.        │ Ihre Apps   │              │ 12 Apps im Katalog ansehen →      │
│ Datenbanken WI24 ──────────── │ Kontingent  │              └────────────────────────────────────┘
│ ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇ │             │
│  ▌ SQL-Labor A–D [Fehlgeschl.]│             │
│    SQL-Labor Demo [Aktiv]     │             │
│ Web-Engineering WWI23 ─────── │             │
│ …                             │             │
└───────────────────────────────┴─────────────┘
```

| Regel | Festlegung |
|---|---|
| Reihenfolge der Kurse | Kurse mit mindestens einem Problem zuerst, dann nach dem jüngsten Deployment, „Ohne Kurs“ zuletzt |
| Reihenfolge in einem Kurs | Fehlgeschlagen, In Bereitstellung, Aktiv; jeweils neueste zuerst. Gestoppte sind eingeklappt („1 gestopptes Deployment anzeigen“) |
| Länge | höchstens 5 sichtbare Zeilen je Kurs, der Rest hinter „n weitere anzeigen“ |
| Band | Segmente in der Reihenfolge Fehlgeschlagen, Aktiv, In Bereitstellung, Gestoppt; Breite proportional, mindestens 8 px |
| Mehrere Kurse | Ein Deployment mit Studierenden aus zwei Kursen steht unter beiden; die Zusammenfassungszeile und die Kacheln zählen es einmal |
| Ohne Kurs | Deployments, deren Mitglieder keinem Kurs angehören (und alle, solange das Backend `courses` nicht liefert: dann eine Gruppe ohne Kopf) |
| Problemzeile | Hintergrund `dangerTint` (50 %), 3 px Rand links in `danger`, Pille „Fehlgeschlagen“ |
| Admin | Queue links (älteste Einreichung zuerst, ab 2 Tagen amber), Karte „Plattform“ rechts, „Ihre Deployments“ eingeklappt darunter |
| Studierende | Karten statt Zeilen; „Zugang öffnen“ nur bei Zustand Aktiv, sonst „Details ansehen“ |

## 6. Zustände
Gefüllt, leer (je Rolle), Laden (wie die Deployments-Liste), Fehler beim Laden („Deployments konnten nicht geladen werden“ mit „Erneut laden“). Bei Bereitstellung ist die Seite live: alle 10 s neu laden, solange etwas im Aufbau ist.
Mockup-Deep-Links (Anker mit `-` verbinden): `#clean` blendet die Mockup-Leiste aus; `#admin`, `#student` wechseln die Rolle; `#leer` zeigt den Leerzustand. Beispiel: `mockup/index.html#clean-student-leer`.

## 7. Texte (Sie-Form, sachlich, kein Ausrufezeichen)
- Hero (alle Rollen und Zustände): Begrüßung und „Willkommen zurück in Ihrer Deployment-Umgebung.“ wie heute.
- Zusammenfassungszeile der Karte „Deployments nach Kurs“ (nur Lehrende): „**6** laufen, 1 wird bereitgestellt, **2 sind fehlgeschlagen**.“ Teile mit 0 entfallen; ohne Deployments entfällt die Zeile. Admin und Studierende haben keine solche Zeile: Kacheln und Karten sagen es schon.
- Leerzustände nennen den Raum und was dort entsteht: „Noch kein Deployment“, „Keine Versionen zur Prüfung“, „Noch keine Umgebung“. Dazu eine Zeile, die sagt, was als Nächstes passiert, und eine Schaltfläche mit Verb.
- Bei Fehlern sagt die Karte, was zu tun ist: „Die Umgebung ist nicht gestartet. Informieren Sie Ihre Lehrenden.“

## 8. Barrierefreiheit
- Das Band ist eine `role="group"` mit Beschriftung („Zustand: 1 fehlgeschlagen, 1 aktiv“); jedes Segment ein Link mit `aria-label`. Zustand steht immer auch als Text (Zähler neben dem Kurs, Pille in der Zeile), nie nur als Farbe.
- Sichtbarer Fokus überall (`outline: 2px solid primary`, wie `.app-shell :where(button, a):focus-visible`).
- Die Pulspunkte und die laufende Leiste stehen still bei `prefers-reduced-motion`.
- Die Karten der Studierenden liegen in einer Region mit `aria-live="polite"`, damit ein Wechsel auf „Aktiv“ angesagt wird.
- Mobil (390 px) gibt es kein horizontales Scrollen; die Datumsspalte rutscht in die Meta-Zeile.
- Begrüßung und Text liegen mobil über dem Foto wie heute (Deckkraft 45 %); der Kontrast dort ist beim Umsetzen mit dem Browser zu prüfen.

## 9. Umsetzung
Siehe das Issue (Komponenten, Datenquellen, Stufen, Tests). Das Mockup ist ein Entwurf und wird nicht gebaut oder ausgeliefert.
