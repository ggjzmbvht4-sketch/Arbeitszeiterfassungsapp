# Konto-Zugang und Einführung

Zielprojekt: `qiquwspmgxcldtoevjxw` (Arbeitszeit). Die Migrationen wurden additiv auf dieses Projekt angewendet. Bestehende Arbeitszeit-Snapshots, Versionsprüfungen und deren Policies bleiben unverändert.

## Datenvertrag

- `account_legal_acceptances`: unveränderliche Bestätigungen je Konto und Dokumentversion. Für Nutzungsbedingungen und Datenschutz gilt derzeit `2026-11-18`.
- Der Client liest ausschließlich eigene Bestätigungen und ruft `accept_current_legal({p_terms_version: '2026-11-18', p_privacy_version: '2026-11-18'})` auf. Der RPC gibt `{user_id, terms_version, privacy_version, accepted_at}` zurück. Nutzer-ID und Zeitpunkt stammen vom Server; wiederholte Aufrufe behalten die erste Bestätigung bei. Direkte Client-Schreibrechte fehlen.
- Der öffentliche RPC verwendet `SECURITY INVOKER`; die schreibende, eng begrenzte Hilfsfunktion liegt im nicht per Data API freizugebenden Schema `private`.
- `account_onboarding`: eigene Zeile mit `tutorial_version: 1`, `status: pending|completed|skipped` und `finished_at`. Für `pending` ist der Zeitpunkt `null`, für `completed`/`skipped` ein ISO-Zeitstempel. Eigene Zeilen dürfen gelesen, angelegt und aktualisiert werden.
- Beide Tabellen sind per RLS kontogetrennt; anonyme Auth-Nutzer sind ausgeschlossen. Bei Kontolöschung werden die Zeilen automatisch entfernt. Datenwiederherstellung und Arbeitszeit-Import ändern diese Metadaten nicht. Demo-Arbeitszeiten gehören niemals in diese Tabellen oder in echte Konto-Snapshots.

Bei einer neuen Dokumentversion müssen RPC-Prüfung und Tabellen-Checks gemeinsam per neuer Migration erweitert werden; alte Bestätigungen erhalten. Eine neue Tutorialversion benötigt ebenfalls eine neue Migration zur Erweiterung des Versions-Checks.

## Einladungen und Auth-Einstellungen

Die Datenbank erzwingt für **neue** Konten eine Einladung. Der verzögerte Constraint-Trigger `auth.arbeitszeit_invited_accounts_only` prüft beim Transaktionsabschluss die endgültige `auth.users.invited_at`-Spalte. Dadurch bleibt Supabase' Einladungsablauf möglich: Er legt die Zeile zunächst an und setzt `invited_at` anschließend in derselben Transaktion. Ein `BEFORE INSERT`-Check wäre hier falsch. Bestehende Konten werden nicht nachträglich geprüft oder ausgesperrt.

Quelle des Ablaufs: offizielle Supabase-Auth-Dateien [invite.go](https://github.com/supabase/auth/blob/master/internal/api/invite.go) und [mail.go](https://github.com/supabase/auth/blob/master/internal/api/mail.go). Bei wesentlichen Auth-Updates den Einladungsablauf erneut prüfen.

Im [Supabase-Dashboard des Arbeitszeit-Projekts](https://supabase.com/dashboard/project/qiquwspmgxcldtoevjxw/auth/users):

1. Unter Authentication die Einstellung **Allow new users to sign up** deaktivieren. Der DB-Trigger schützt unabhängig davon; die native Sperre liefert für öffentliche Registrierungsversuche die passende Auth-Antwort. Dafür war in der Ausführungsumgebung keine Management-API-Berechtigung verfügbar.
2. Unter **Users → Invite user** die gewünschte E-Mail-Adresse einladen. Bestehende Nutzer melden sich weiterhin normal an; es werden keine Einladungen automatisch verschickt.
3. Als Site URL `https://ggjzmbvht4-sketch.github.io/Arbeitszeiterfassungsapp/` setzen. Dieselbe URL und bei Bedarf die explizite `index.html`-Variante als erlaubte Redirect URLs eintragen. Lokale Entwicklungsadressen nur für Tests zusätzlich freigeben.
4. Für zuverlässige Einladungs- und Wiederherstellungsmails SMTP im Projekt konfigurieren; Einladungs- und Reset-Templates müssen den Supabase-Bestätigungslink beibehalten. Abgelaufene Einladungen im Dashboard erneut versenden. Neue Konten per Admin-Create ohne Einladungsablauf werden vom Trigger ebenfalls abgewiesen.

Keine `service_role`-/Secret- oder Management-Schlüssel in das Frontend, diese Dokumentation oder Browser-Speicher übernehmen. URL und Publishable Key sind öffentliche Client-Konfiguration.

## Prüfung

`tests/account_access_and_tutorial.sql` verwendet zufällige synthetische Auth-IDs und rückrollende PL/pgSQL-Untertransaktionen; ein lokales Statement-Timeout begrenzt die Ausführung. Es prüft die verzögerte Registrierungssperre, den tatsächlichen INSERT→invited_at-UPDATE-Ablauf einer Einladung, RPC-Idempotenz, Dokumentversionen, Onboarding-Checks, die Fremdschlüsselkonfiguration und Client-Grants. Es enthält keine Löschanweisungen; auch die Kaskadeneinstellung wird ausschließlich aus dem Systemkatalog gelesen. Es versendet keine E-Mails und benötigt keine echten Kontodaten.

Zusätzlich geprüft: RLS auf beiden Tabellen, kontobezogene SELECT/INSERT/UPDATE-Policies, fehlende direkte Consent-Schreibrechte, anonyme Zugriffsverweigerung und beide Cascade-Fremdschlüssel. Authentifizierung, Link-Verarbeitung, Offline-Wiederöffnung und Tutorial-Isolation sind separat im Frontend zu testen. Der synthetische Datenbanktest wurde erfolgreich ausgeführt; die Prüfsummen bestehender Arbeitszeit-Snapshots und Sicherungen waren vorher und nachher identisch. Echte Einladungs-E-Mails wurden nicht versendet; Versand und Redirect-Konfiguration lassen sich beim ersten gewollten Dashboard-Invite prüfen.
