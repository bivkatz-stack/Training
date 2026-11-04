# Mein Training

Ein persönlicher, kostenloser Trainings-Tracker als installierbare PWA. Die App verwendet nur HTML, CSS und JavaScript, hat keine externen Abhängigkeiten und speichert Trainingsdaten ausschließlich im lokalen Browser-Speicher. Es gibt weder Konten noch einen Server. Der Service Worker hält die App-Dateien für den Offline-Betrieb bereit.

## Lokal testen

PWAs und Service Worker benötigen `localhost` oder HTTPS. Öffne ein Terminal im Projektordner und starte einen der lokalen Server:

```bash
python -m http.server 8000
```

Alternativ, sofern Node.js bereits installiert ist:

```bash
npx serve .
```

Rufe anschließend die im Terminal angezeigte Adresse auf (beim Python-Beispiel `http://localhost:8000`). Nach dem ersten Laden kann die App über den Service Worker offline verwendet werden. `file://` ist zum Testen der Offline-Funktionen nicht geeignet.

## Kostenlos mit GitHub Pages veröffentlichen

1. Erstelle auf GitHub ein öffentliches Repository und lade diese Dateien in den Hauptbranch hoch.
2. Öffne im Repository **Settings → Pages**.
3. Wähle bei **Build and deployment** die Bereitstellung **Deploy from a branch**, dann den Hauptbranch und den Ordner `/(root)`, und speichere.
4. Warte, bis GitHub Pages die Website veröffentlicht hat. Die angezeigte HTTPS-Adresse kann geöffnet und auf dem Handy installiert werden.

Die App verwendet relative Pfade und funktioniert auch unter einem GitHub-Pages-Projektpfad. Die Inhalte werden vollständig lokal auf dem jeweiligen Gerät gespeichert; GitHub Pages erhält keine Trainingsdaten.

## Auf dem Google Pixel installieren

1. Öffne die HTTPS-Adresse in Chrome auf dem Pixel und lade die Seite einmal vollständig.
2. Öffne das Chrome-Menü (⋮) und wähle **App installieren** oder **Zum Startbildschirm hinzufügen**.
3. Starte die App künftig über das neue Symbol. Nach dem initialen Laden funktioniert sie auch ohne Internet.

## Backups und Datenschutz

Unter **Einstellungen** lassen sich alle Daten als JSON exportieren und später wieder importieren. Ein Import ersetzt die vorhandenen Daten erst nach einer Bestätigung. Browserdaten können unabhängig davon gelöscht werden; bewahre wichtige Backups daher an einem sicheren Ort auf. Der Browser wird beim Start um persistenten Speicher gebeten, kann diese Anfrage aber ablehnen.

Die Daten besitzen eine `schemaVersion`, damit spätere Versionen bei Bedarf Migrationen ergänzen können.

Wenn du später Dateien aktualisierst, erhöhe vor der Veröffentlichung auch die Cache-Version `CACHE_NAME` in `service-worker.js`. Dadurch ersetzt die neue Version zuverlässig den Offline-Cache.
