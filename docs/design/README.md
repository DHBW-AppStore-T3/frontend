# Design-Mockups

Mockups und Design-Pläne zu UI-Issues. Jeder Ordner gehört zu einem Issue und enthält:

- `design-plan.md`: Befund, verworfene Ideen, Designsystem (Tokens), Layout, Zustände, Texte, Barrierefreiheit, Umsetzung.
- `mockup/index.html`: ein interaktives Mockup in einer einzigen HTML-Datei.
- `screenshots/`: Ist-Zustand und die wichtigsten Ansichten des Mockups.

| Ordner | Issue | Inhalt |
|---|---|---|
| [`109-windows-vm-variablen/`](109-windows-vm-variablen/) | [#109](https://github.com/DHBW-AppStore-T3/frontend/issues/109) | Variablen-Schritt der Windows-VM-App: Internetzugriff immer sichtbar, Rechenressourcen in den Experteneinstellungen |
| [`113-datei-variablen/`](113-datei-variablen/) | [#113](https://github.com/DHBW-AppStore-T3/frontend/issues/113) | Datei-Variablen (Web-LaTeX, Online-IDE): eine Datei für alle, früh geprüft |

## Mockups ansehen

GitHub zeigt eine HTML-Datei nur als Quelltext. Zum Ansehen das Repo auschecken (oder die Datei herunterladen) und `mockup/index.html` im Browser öffnen. Die Schrift Inter wird aus `src/assets/fonts/` geladen; ohne sie fällt die Seite auf die Systemschrift zurück.

Oben im Mockup (dunkle Leiste) lassen sich Zustände umschalten, zum Beispiel „Heute / Neu“, die App, die Zahl der Studierenden. Die Leiste gehört nicht zum Design.

Für Bildschirmfotos gibt es Deep-Links (Anker an der URL, mehrere mit `-` verbinden):

| Anker | Wirkung |
|---|---|
| `#clean` | blendet Mockup-Leiste, Navigation und Notizen aus |
| `#open`, `#changed`, `#off`, `#one`, `#old` | (109) Experteneinstellungen auf, Werte angepasst, Internet gesperrt, eine Person, Ansicht „Heute“ |
| `#filled`, `#partial`, `#errtotal`, `#each`, `#open`, `#ide`, `#12`, `#team`, `#nodesc` | (113) Datei für alle, eine Datei pro Person, Fehler „zusammen zu groß“, Modus „pro Person“, Beschreibung auf, Online-IDE, 12 Studierende, Teams, ohne Beschreibung der App |

Beispiel: `mockup/index.html#clean-filled`.

## Hinweise

- Die Mockups sind Entwürfe und werden nicht gebaut oder ausgeliefert (Vite baut nur `src/`).
- Farben, Radien und Schatten entsprechen den Tokens aus `src/theme/themes/t3.ts` und `src/styles/tokens.css`.
- Texte in Sie-Form, wie im Rest der App.
