# Design-Plan: Variablen-Schritt der Windows-VM-App

Zu [frontend#109](https://github.com/DHBW-AppStore-T3/frontend/issues/109). Mockup: [`mockup/index.html`](mockup/index.html) (interaktiv, Schalter „Heute / Neu", 1 oder 3 Studierende).

Bilder (Ist-Zustand und Ansichten des Mockups): [`0-ist-zustand`](screenshots/0-ist-zustand.png), [`1-neu-zugeklappt`](screenshots/1-neu-zugeklappt.png), [`2-neu-aufgeklappt`](screenshots/2-neu-aufgeklappt.png), [`3-neu-angepasst`](screenshots/3-neu-angepasst.png), [`4-neu-mobil`](screenshots/4-neu-mobil.png).

## 1. Worum es geht
- **Nutzer:** nicht technischer Dozent, der einen Windows-Desktop mit MATLAB für seine Studierenden einrichtet.
- **Aufgabe der Seite:** eine Entscheidung treffen (dürfen die Studierenden ins Internet?) und dabei die Rechenleistung ruhig auf der Empfehlung lassen können.
- **Rahmen:** rotes T3-Theming (DHBW-Rot `#E2001A`), Inter, Tokens aus `src/theme/themes/t3.ts`. Der Wizard-Rahmen (Stepper, Titel, Zurück/Weiter) bleibt, wie er ist.

## 2. Review des ersten Entwurfs
Der erste Gedanke war: beide Karten mit rotem Kopfbalken und weißer Schrift, die grüne Ressourcenkarte einfach rot einfärben, Schalter wie heute. Das ist die Vorlagenlösung „Karte mit farbigem Header" und ändert nichts am eigentlichen Problem: Die Seite erklärt nicht, was ein Zustand bedeutet, und zugeklappt verschwinden Werte, die trotzdem gelten.

| Verworfen | Warum | Stattdessen |
|---|---|---|
| Roter Kopfbalken pro Karte | Dekoration, trägt keine Information; bei zwei Karten wirkt Rot als Warnung | Weiße Karten. Rot nur für Zustand und Bedienung (Schalter an, Regler, geänderte Zahl, Fokus) |
| Zwei große Auswahlkacheln „Mit / Ohne Internet" | Eindeutiger, aber ein neues Bedienelement, mehr Text und ein Bruch mit `role="switch"` aus dem Issue | Schalter bleibt. Dazu **Status** („Erlaubt" / „Gesperrt") und **eine Folgezeile**, die mitwechselt |
| Zugeklappt nur „Experteneinstellungen ⌄" | Der Dozent sieht nicht, was gilt, und merkt Änderungen nicht | Zugeklappt zeigt das **Typenschild** „Empfohlen · 4 vCPU · 8 GB RAM", nach einer Änderung „Angepasst" in Rot |
| Zahlenbereich als Text („Erlaubt 2 – 8 · empfohlen 4") | Muss gelesen und im Kopf auf den Regler abgebildet werden | **Kerben** pro Schritt und eine Markierung „empfohlen" direkt am Regler |

**Signatur (der eine gewagte Punkt):** *Die Zahl ist die Oberfläche.* Das Typenschild ist zugeklappt die Zusammenfassung und aufgeklappt das große Ablesefeld jedes Reglers. Alles andere bleibt ruhig.

## 3. Designsystem (aus den echten T3-Tokens)

| Rolle | Wert | Tailwind-Token | Einsatz |
|---|---|---|---|
| DHBW-Rot | `#E2001A` | `primary` | Schalter „an", Regler, geänderte Zahlen, aktive Kerbe, Fokus |
| Rot dunkel | `#C3001B` | `primaryDark` | Textlink „Auf Empfehlung zurücksetzen" |
| Rot tief | `#960015` | `primaryDeep` | Text auf Rosé (Status, Chip, Icon) |
| Rosé | `#FDEDEE` / `#FAD6DA` | `primaryFaint` / `primarySoft` | Icon-Fläche, Status „Erlaubt", Fokus-Halo |
| Tinte | `#0F1B30` | `textHeading` | Titel, Zahlen |
| Schiefer | `#1F2E44` | `textStrong` | Hilfetexte, Beschriftungen |
| Bernstein | `#B45309` / `#FEF3C7` | `warning` / `warningTint` | Folgezeile bei „Erlaubt" (bewusst nicht rot: meint „Vorsicht", nicht „aktiv") |
| Fläche | `#FFFFFF` / `#F9FAFB` / `#EFF2F6` | `surface` / `surfacePage` / `surfaceMuted` | Karte, Typenschild, ruhige Info-Zeile |
| Linie | `#E4E9EF` | `borderSubtle` | Kartenrand, Trennlinien |

**Kontrast (gemessen):**
- Rot auf Weiß 4,94:1; Weiß auf Rot 4,94:1.
- Rot auf `primaryFaint` nur **4,36:1**, deshalb dort `primaryDeep` (8,03:1) oder `primaryDark` (5,55:1).
- `textMuted` auf Weiß nur **4,37:1**, deshalb für Hilfetexte `textStrong` (13,7:1); `textMuted` nur für Deko oder große Schrift.
- `warning` auf `warningTint` 4,51:1 (knapp bestanden), Folgezeile deshalb 13 px und `font-medium`.
- `textFaint` (2,62:1) nur für Kerben, nie für Text.

**Typografie:** Inter (hat die App schon), `tabular-nums` für alle Werte.
- Titel 16 px/700 (`text-base font-bold`).
- Hilfetext 14 px/21 px (`text-sm`), maximal etwa 52 Zeichen breit.
- Ablesefeld `text-headline-1` (36 px) mit `font-extrabold tracking-tight`; der Mockup zeigt 40 px, das nächste Token ist 36 px.
- Mikro-Labels (Status, Chip, Einheit, Tick-Beschriftung): `text-xs font-bold uppercase tracking-wider`, wie die Stepper-Beschriftungen („AUSWAHL").

**Form:** Karten `rounded-xl`, Icon-Fläche `rounded-lg`, Pillen `rounded-full`, Schatten `shadow-md`. Abstand zwischen den Karten 16 px, Karteninnenabstand 24 px.

## 4. Layout

Schmale Spalte (`max-w-3xl`, 720 px, zentriert) statt der vollen Seitenbreite von heute (~1120 px): so bleiben Hilfetexte bei etwa 55 Zeichen pro Zeile. Zurück/Weiter bleiben in der bisherigen Breite.

```
Zugeklappt (Standard)
┌──────────────────────────────────────────────────────────┐
│ [🌐]  Internetzugriff                     ● ERLAUBT  (●━) │
│       Die Windows-Desktops Ihrer Studierenden können …   │
│ ┌ ⚠ Studierende können Server im Internet erreichen. ──┐ │  bernstein
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ [≡]  Experteneinstellungen                              ⌄ │
│      EMPFOHLEN  ┃ 4 VCPU ┃ 8 GB RAM ┃                     │  Typenschild
└──────────────────────────────────────────────────────────┘

Aufgeklappt, angepasst
┌──────────────────────────────────────────────────────────┐
│ [≡]  Experteneinstellungen                              ⌃ │
│      ● ANGEPASST ┃ 6 VCPU ┃ 12 GB RAM ┃   (Zahlen in Rot)  │
├──────────────────────────────────────────────────────────┤
│ Rechenressourcen            ↺ Auf Empfehlung zurücksetzen │
│ Wählen Sie, wie viel Rechenleistung jeder Windows-Desktop │
│ erhält. Die empfohlenen Werte sind vorausgewählt.         │
│                                                           │
│ Prozessorkerne (vCPU)                          6 VCPU     │  ← Ablesefeld
│ ━━━━━━━━━━━━━━━━━━◉─────────────                          │
│ ╵2   ╵3   ╵4   ╵5   ╵6   ╵7   ╵8                          │
│           EMPFOHLEN                                       │
│ Arbeitsspeicher (RAM)                          12 GB      │
│ ━━━━━━━━━━━━━━━━━━◉─────────────                          │
│ ╵4  ╵ ╵ ╵ ╵8 ╵ ╵ ╵ ╵12 ╵ ╵ ╵ ╵16                         │
│          EMPFOHLEN                                        │
│ [👥 Insgesamt für 3 Personen: 18 vCPU · 36 GB RAM]        │
│ ───────────────────────────────────────────────────────── │
│ Vernetzte Desktops  (nur ab 2 Studierenden)         (━●)  │
└──────────────────────────────────────────────────────────┘
```

Mobil (≤ 640 px): Karten füllen die Breite, Status und Schalter rutschen unter den Text (Schalter rechts), das Typenschild umbricht unter den Chip, Regler laufen über die volle Breite. Kein horizontales Scrollen (im Mockup bei 375 px geprüft).

## 5. Die Bausteine im Detail

### Karte 1: Internetzugriff (immer sichtbar)
| Zustand | Status | Schalter | Folgezeile |
|---|---|---|---|
| Erlaubt (Standard der App) | „● Erlaubt" in `primaryFaint`/`primaryDeep` | an (Rot) | bernstein, Warnsymbol: „Studierende können Server im Internet erreichen." |
| Gesperrt | „● Gesperrt" in `surfaceMuted`/`textStrong` | aus (Grau) | ruhig grau, Schloss: „Studierende arbeiten ohne Internetzugriff." |

- Die Folgezeile steht in **beiden** Zuständen da. Sie sagt, was die Entscheidung bedeutet, statt nur bei „an" zu warnen. Sie wechselt per `role="status"` (höflich angekündigt), nicht als `alert`.
- Ganze Karte hat `aria-labelledby`; der Schalter bekommt `aria-describedby` auf Beschreibung und Folgezeile.

### Karte 2: Experteneinstellungen (zugeklappt)
- Kopfzeile ist ein Button (`aria-expanded`, `aria-controls`), Fokusring innen.
- **Typenschild:** zwei Segmente „4 vCPU" und „8 GB RAM" mit Haarlinie dazwischen, Zahlen `font-extrabold tabular-nums`.
- **Chip:** „Empfohlen" (grau) oder „● Angepasst" (`primaryFaint`/`primaryDeep`); bei „Angepasst" sind die Zahlen im Typenschild `primaryDark`.
- Aufklappen mit `grid-template-rows 0fr → 1fr` (300 ms). Zugeklappt ist der Inhalt `inert` und `visibility:hidden`, kein Tab-Stopp im Verborgenen.

### Regler (aufgeklappt)
- **Natives `<input type="range">`**, nur gestaltet. Tastatur, Screenreader und bestehende Tests (`getAllByRole('slider')`, `fireEvent.change`) bleiben gültig.
- **Track:** 8 px, Füllung bis zum Daumen in `primary`, Rest `surfaceMuted`. Füllung per CSS-Variable `--p` (0 bis 1).
- **Daumen:** 26 px weiß mit 4 px rotem Rand; bei Fokus ein Halo in `primarySoft` (zusätzlich zum Browser-Fokusring, nie ohne).
- **Kerben:** eine pro Schritt (vCPU 2 bis 8: alle beschriftet; RAM 4 bis 16: alle 4 GB beschriftet). Die Empfehlung hat eine längere rote Kerbe und die Beschriftung „EMPFOHLEN"; Kerben sind `aria-hidden`.
- **Ablesefeld:** große Zahl rechts über dem Regler (`<output for>`), Einheit klein daneben. Zahl wird beim Ändern rot, sobald sie von der Empfehlung abweicht, und „springt" einmal (170 ms).
- **`aria-valuetext`:** „4 vCPU, empfohlen" bzw. „6 vCPU".
- **Zurücksetzen:** Textlink „Auf Empfehlung zurücksetzen" nur sichtbar, wenn etwas abweicht; setzt beide Regler zurück und gibt den Fokus an den ersten Regler.
- **Gesamtzeile (optional):** „Insgesamt für 3 Personen: 12 vCPU · 24 GB RAM". Rechnet aus `scope: user` (eine VM pro Person) × Wert und zeigt dem Dozenten die Folge seines Reglers.

### Vernetzte Desktops
Zeile unter einer Trennlinie, Text links, Schalter rechts. Nur bei mindestens 2 Studierenden (sonst entfällt die Zeile, wie `visibleNetworkKeys` es schon regelt).

## 6. Texte
Sie-Form, Verben statt Systembegriffen. „Pods" gehört nicht zu einer Windows-VM.

| Stelle | Heute | Vorschlag |
|---|---|---|
| Internetzugriff, Beschreibung | Erlaubt den Pods, Server im Internet zu erreichen. Interne Netze bleiben gesperrt. | Die Windows-Desktops Ihrer Studierenden können Server im Internet erreichen. Interne Netze bleiben gesperrt. |
| Folgezeile „Erlaubt" | Studierende können **dann** Server im Internet erreichen. | Studierende können Server im Internet erreichen. |
| Folgezeile „Gesperrt" | – | **neu:** Studierende arbeiten ohne Internetzugriff. |
| Status | – | **neu:** Erlaubt / Gesperrt |
| Chip | – | **neu:** Empfohlen / Angepasst |
| Zurücksetzen | – | **neu:** Auf Empfehlung zurücksetzen |
| Ressourcen, Beschreibung | Wählen Sie, wie viele vCPUs und wie viel Arbeitsspeicher Ihr Deployment erhält. Die empfohlenen Werte sind vorausgewählt. | Wählen Sie, wie viel Rechenleistung jeder Windows-Desktop erhält. Die empfohlenen Werte sind vorausgewählt. |
| CPU-Label | vCPU | Prozessorkerne (vCPU) |
| RAM-Einheit | 8Gi | 8 GB (nur Anzeige; die Nutzlast bleibt `8Gi`) |
| Bereichsangabe | Erlaubt 2 – 8 · empfohlen 4 | entfällt: Kerben und Markierung „empfohlen" |
| Pods-Zeile | Vernetzte Pods / Erlaubt den Pods dieses Deployments, … | Vernetzte Desktops / Erlaubt den Desktops dieses Deployments, sich gegenseitig zu erreichen. Andere Deployments bleiben getrennt. |
| Gesamtzeile (optional) | – | Insgesamt für 3 Personen: 12 vCPU · 24 GB RAM |

## 7. Bewegung und Barrierefreiheit
- **Bewegung nur dort, wo sie etwas zeigt:** Akkordeon, Schalter-Daumen, einmaliges „Springen" der Zahl beim Ändern. Mit `prefers-reduced-motion` auf nahezu 0 ms.
- **Fokus:** überall sichtbar (2 px Rot, bei Schalter und Link mit Abstand); der Mockup wurde per Tab und Enter durchgespielt.
- **Ziele:** Schalter 46 × 28 px, Daumen 26 px, Kopfzeile des Akkordeons über die ganze Breite klickbar.
- **Farbe allein trägt nichts:** Zustand steht immer auch als Text („Erlaubt", „Angepasst", „Empfohlen").

## 8. Umsetzung im Frontend

**Neue Dateien** (alles unter `src/views/new-deployment/`):
| Datei | Aufgabe |
|---|---|
| `NetworkSwitchRow.tsx` | Schalterzeile (Label, Hilfetext, `Toggle`) für Internet und Pods |
| `VmInternetAccess.tsx` | Karte 1 mit Status, Schalter, Folgezeile |
| `VmExpertSettings.tsx` | Karte 2: Akkordeon mit Typenschild-Kopf, enthält Regler, Gesamtzeile und Pods-Zeile |
| `VmResourceSliders.tsx` | Regler mit Ablesefeld, Kerben, Markierung, Zurücksetzen |
| `vm-slider.css` | Track, Daumen, Fokus (nur `rgb(var(--color-…))`, keine Literale) |

`src/utils/resources.ts` bekommt zwei kleine Helfer: `formatMemoryGb(mib)` für die Anzeige und `isDefaultSelection(choices, resources)` für „Empfohlen/Angepasst". `NetworkSettings.tsx` und `ResourcePicker.tsx` bleiben unverändert (Pod-Apps).

**Token-Regeln des Repos:** keine Farbliterale (`colors.spec.ts`), keine beliebigen Radius- oder Schattenwerte (Allowlist). Das Mockup nutzt nur Werte, die es als Token gibt; Abweichungen: Ablesefeld 36 statt 40 px (`text-headline-1`), Mikro-Labels 12 statt 11 px (`text-xs`), Schatten `shadow-md` als nächstes Token.

**i18n:** neue Schlüssel unter `deployment.vm.*` in `de.ts` **und** `en.ts` (es gibt einen Paritätstest für `deployment.network`, ihn für die neuen Schlüssel erweitern). Der bestehende Schlüssel `deployment.network.podNetwork.label` steht auch in der Übersicht (Schritt 4); „Vernetzte Desktops" dort braucht eine eigene Entscheidung.

**Tests zusätzlich zum Issue-Testplan:**
- Typenschild zeigt „Empfohlen" und `4 vCPU · 8 GB RAM`; nach Änderung „Angepasst" und die neuen Werte (auch zugeklappt).
- „Auf Empfehlung zurücksetzen" erscheint nur bei Abweichung und stellt beide Werte her.
- Folgezeile wechselt zwischen „Erlaubt" und „Gesperrt"; Status-Pille ebenso.
- Gesamtzeile rechnet `studentIds.length × Wert` (1 Person: Singular).
- Regler: `aria-valuetext` enthält „empfohlen" genau beim Standardwert; Kerben: 7 bei vCPU, 13 beim RAM, eine Empfehlungs-Markierung je Regler.
- Zugeklappt ist der Körper `inert` und enthält keine fokussierbaren Elemente.

Umfang: fünf neue Dateien, zwei Helfer, kein Eingriff in Store, API oder Pod-Pfad.

## 9. Was sich gegenüber Issue 109 ändern würde
1. **Regler:** `VmResourceSliders` statt `ResourcePicker` im Akkordeon (Issue: „unverändert, grüne Karte").
2. **Neue Texte** (Issue: „keine neuen Texte nötig") laut Tabelle in Abschnitt 6.
3. **Status und Folgezeile** bei der Internetkarte in beiden Zuständen (Issue: Warnhinweis nur bei „an", `role="alert"`).
4. **Zusammenfassung im zugeklappten Kopf** (neu).
5. **Gesamtzeile** (neu, optional).
6. **Spaltenbreite** 720 px nur für den VM-Zweig.

## 10. Entscheidungen für Sie
- **Neue Texte ja oder nein?** Ohne sie bleibt „Pods" und „8Gi" auf einer Windows-Seite stehen.
- **„Vernetzte Desktops":** Übersichtsschritt mitziehen oder nur im Variablen-Schritt ändern?
- **Gesamtzeile:** drin lassen oder streichen?
- **Anzeige „GB":** 8 GiB werden als „8 GB" gezeigt (so zeigt es auch Windows). Einverstanden?

## 11. Beobachtungen außerhalb des Issues
- Der **Weiter-Button ist grün** (`success`), der Rest des Wizards rot. Das passt nicht zum roten Theming, gehört aber zum ganzen Wizard und nicht zu diesem Issue.
- `textMuted` unterschreitet AA (4,37:1) und wird in der App für kleine Hilfetexte verwendet.
