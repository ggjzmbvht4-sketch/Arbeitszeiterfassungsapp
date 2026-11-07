[README.md](https://github.com/user-attachments/files/34516711/README.md)
# Arbeitszeiterfassung – überarbeitete Version

## Bestehende App aktualisieren

1. Wenn die bisherige App noch startet, zuerst ein JSON-Backup exportieren.
2. ZIP entpacken. Die enthaltene `index.html` ersetzt die bisherige `index.html`.
   Für Offline-Nutzung auch `sw.js`, `manifest.webmanifest` und die Symbole übernehmen.
3. Dieselbe Internetadresse und denselben Browser wie bisher verwenden.
   Der Datenbankname `arbeitszeit-app`, die Version 1 und der bisherige Speicheraufbau bleiben erhalten.
4. Alle alten App-Fenster schließen und die App erneut öffnen. Bei einer bereits installierten
   Offline-App kann ein weiterer Neustart nach dem Laden der Aktualisierung nötig sein.
5. Bei einem Umzug auf eine andere Internetadresse oder in einen anderen Browser das vorherige
   JSON-Backup importieren. Browserdaten werden nicht automatisch zwischen Adressen übertragen.

Zum lokalen Ausprobieren im entpackten Ordner beispielsweise
`python3 -m http.server 8000` starten und `http://localhost:8000` öffnen.
Die App benötigt keine zusätzlichen JavaScript-Pakete und keine externen Skripte.
Für die Installation und Offline-Nutzung einen Webserver mit HTTPS oder localhost verwenden.
Das direkte Öffnen einer HTML-Datei ist wegen unterschiedlicher Browserregeln für lokalen
Speicher und Downloads weniger zuverlässig.

## Behobene Fehler

- Doppelte Funktionsdeklarationen und doppelte Ereignisbehandlungen entfernt.
  Insbesondere verhindert die doppelte Funktionsdeklaration im ursprünglichen Modul dessen Start.
  Jeder Klick und jede Formulareingabe hat jetzt genau eine Ereignisbehandlung.
- Fehlende PDF-Erstellung und Download-Funktion ergänzt. Monats- und Jahresberichte
  werden vollständig lokal erzeugt, einschließlich Umlauten und Kalender.
- PDF-Seitenumbrüche anhand der tatsächlichen Zeilenhöhen berechnet, lange Notizen umgebrochen
  und Jahreskalender innerhalb der Seite angeordnet. Jahreswerte für noch offene Zeitkonten
  werden nicht mehr als endgültiger Jahresendsaldo ausgegeben.
- Mehrfaches Speichern sowie konkurrierende Änderungen während Speichern, Löschen,
  Wiederherstellen und Import werden innerhalb eines Fensters gesperrt.
- Eine zusätzliche Datenrevision verhindert, dass zwei Fenster unbemerkt denselben
  Datenbestand überschreiben. Bei einem Konflikt muss das ältere Fenster neu geladen werden.
- Bei fehlgeschlagenem Speichern, Löschen, Wiederherstellen oder Import wird der vorherige
  Zustand im Arbeitsspeicher wiederhergestellt. Ein Import entfernt veraltete Rückgängig-Aktionen.
- Backups werden auf echte Kalenderdaten, eindeutige IDs, zulässige Uhrzeiten,
  Pausen, Stundenwerte, Urlaubstage und Einstellungen geprüft. Unbekannte zusätzliche
  Felder werden nicht in den Arbeitsbestand übernommen.
- Arbeitszeiten aus Beginn und Ende werden beim Laden nachgerechnet. Rundung erfolgt
  erst für die Anzeige, damit sich Rundungsfehler nicht je Arbeitsblock aufsummieren.
- Urlaub und Krankheit erzeugen an bereits angerechneten Feiertagen keine zusätzlichen
  Abwesenheitsstunden. Ein neuer Urlaubseintrag an einem solchen Feiertag wird abgelehnt.
- Doppelte Krankheitstage, mehr als ein Urlaubstag pro Datum und widersprüchliche
  Abwesenheiten werden bei der Eingabe abgewiesen. Ein halber Urlaubstag mit Arbeit bleibt möglich.
- Kalender zeigt bei Urlaub oder Krankheit nicht mehr gleichzeitig den Hinweis „frei“.
- Versteckte, nicht verwendete Eingabefelder blockieren nicht mehr die Formularprüfung.
- Monatswechsel springt jeweils genau einen Monat. Navigation und Datumsprüfung sind
  auf den unterstützten Zeitraum 2000 bis 2200 begrenzt.
- Anfangssaldo erscheint nicht mehr vor dem eingestellten Beginn des Zeitkontos.
- Dialogfokus, Tastaturbedienung, Umbruch bei schmalen Ansichten und dunkle Stundenanzeige verbessert.
- Fehlende Offline-Dateien, App-Manifest und Symbole ergänzt.

## Berechnungsregeln

- Monatssoll bleibt ein fester, frei einstellbarer Stundenwert.
- Monatsüberträge berücksichtigen nur abgeschlossene Monate ab dem Zeitkontostart.
  Der laufende Monat zeigt seine vorläufige Differenz und wird nach Monatsende übernommen.
- Tatsächliche Arbeit an einem Feiertag wird wie bisher zusätzlich zur Feiertagsgutschrift gezählt.
  Ob das deiner betrieblichen Regel entspricht, kannst du anhand der getrennten Berichtswerte prüfen.
- Anrechenbare Feiertage beziehen sich weiterhin ausschließlich auf Baden-Württemberg
  und die ausgewählten Wochentage. Die App entscheidet nicht über individuelle betriebliche Ansprüche.
- Jahresurlaub berücksichtigt auch bereits eingetragenen, künftig geplanten Urlaub.
  Urlaub auf angerechneten Feiertagen verbraucht keine Urlaubstage. Alte doppelte
  Abwesenheitseinträge werden für die Anrechnung pro Datum begrenzt; die Einträge selbst
  werden nicht automatisch gelöscht. Bereits vorhandene doppelte Arbeitsblöcke bitte prüfen.
- Einstellungen gelten weiterhin für die gesamte Historie. Eine zeitabhängige Verwaltung
  von Vertragsänderungen oder unterschiedlichen Jahresansprüchen ist nicht enthalten.
- Zeitspannen müssen innerhalb eines Kalendertags liegen. Nachtschichten mit zwei
  Einträgen auf den jeweiligen Tagen oder als direkte Dauer erfassen. Bei direkter Dauer
  wird der gesamte Block dem ausgewählten Datum zugeordnet.
- Pausen werden manuell erfasst, nicht automatisch ergänzt. Der Bereich zwischen zwei
  Arbeitsblöcken ist bereits nicht angerechnet und sollte nicht zusätzlich als Pause abgezogen werden.
- Alle Daten bleiben im lokalen Browserspeicher. JSON-Backups regelmäßig separat sichern;
  sie sind nicht verschlüsselt. Die App synchronisiert nicht zwischen Geräten.

## Prüfung

Mit Node.js: `node tests/regression.cjs`

53 automatisierte Prüfungen bestanden: einmalige Ereignisbehandlung, Erfassung und Bearbeitung,
Pausen, Abwesenheitskonflikte, Feiertage, Schaltjahre, Monatsüberträge, Backup-Validierung,
Rücksetzen bei Speicherfehlern, Rückgängig, gleichzeitige Eingaben, PDF-Exporte sowie
Speicherrevision und Konflikterkennung. Die Tests führen den tatsächlichen Anwendungscode aus;
DOM und Datenbanktransaktionen werden nachgebildet. Sie ersetzen keinen vollständigen Browsertest.

Zusätzlich wurden die erzeugten Monats- und Jahres-PDFs geöffnet und alle Textpositionen
auf Einhaltung der Seitengrenzen geprüft. JavaScript-Syntax und Manifest wurden geprüft.
Ein tatsächlicher Browserstart war in der Prüfungsumgebung technisch gesperrt.
Safari, iPhone-Installation und das Offline-Verhalten wurden daher nicht praktisch getestet.
