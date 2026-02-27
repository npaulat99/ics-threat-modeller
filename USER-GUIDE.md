# ICS Threat Modeller — User Guide

Setup- und Betriebsanleitung für das kollaborative Attack-Tree Threat Modelling mit Git-Repository-Integration.

**Zielgruppe:** Security-Analysten und Penetration Tester mit Erfahrung in Git, Docker und Linux-Shell.

---

## Inhaltsverzeichnis

- [1. Überblick](#1-überblick)
- [2. Architektur der zwei Repositories](#2-architektur-der-zwei-repositories)
- [3. Voraussetzungen](#3-voraussetzungen)
- [4. Erstinstallation](#4-erstinstallation)
- [5. Catalog-Repo einrichten](#5-catalog-repo-einrichten)
- [6. Projekt-Repo einrichten](#6-projekt-repo-einrichten)
- [7. Tägliche Arbeit: Workflow-Beispiele](#7-tägliche-arbeit-workflow-beispiele)
- [8. Kollaboration über Branches & Pull Requests](#8-kollaboration-über-branches--pull-requests)
- [9. Catalog-Repo erweitern](#9-catalog-repo-erweitern)
- [10. Verzeichnisstruktur-Referenz](#10-verzeichnisstruktur-referenz)
- [11. Troubleshooting](#11-troubleshooting)

---

## 1. Überblick

Der ICS Threat Modeller ist eine Desktop-Applikation (Tauri 2 / Rust + Svelte) für angriffsbaumbasiertes Threat Modelling von ICS-Geräten. Die Applikation läuft im Docker-Container mit Browser-Zugriff über noVNC.

Daten werden in zwei getrennten Git-Repositories verwaltet:

| Repository | Zweck | Scope |
|---|---|---|
| **Catalog-Repo** | Zentrale Bibliothek von Attack-Tree-Templates und Tag-Vorschlägen | Team-weit, read-only aus Sicht der App |
| **Projekt-Repo(s)** | Projektdaten als YAML-Dateien (pro Projekt ein Repo) | Pro Assessor/Team, schreibend |

Die App selbst führt **keine** Git-Operationen aus. Der User verwaltet `git clone`, `commit`, `push`, `pull` etc. selbst im Terminal. Die App liest/schreibt ausschließlich YAML-Dateien in vordefinierten Verzeichnissen.

---

## 2. Architektur der zwei Repositories

```
/app/data/                              ← Docker-Volume (persistent)
├── ics_threat_modeller.db              ← SQLite (Laufzeit-Datenbank)
│
├── catalog-repo/                       ← Git-Repo #1: Catalog
│   ├── .git/
│   ├── catalog/                        ← Attack-Tree-Templates (je 1 YAML)
│   │   ├── firmware-compromise.yaml
│   │   ├── credential-theft.yaml
│   │   ├── denial-of-service.yaml
│   │   ├── information-leakage.yaml
│   │   ├── persistent-access.yaml
│   │   ├── process-manipulation.yaml
│   │   ├── sensor-spoofing.yaml
│   │   └── supply-chain-attack.yaml
│   └── tag-catalog/                    ← Tag-Vorschläge nach Kategorie
│       ├── assets.yaml                 ← 20 ICS-Asset-Typen
│       ├── interfaces.yaml             ← 28 Protokolle/Interfaces
│       └── third-party-software.yaml   ← 30 Software-Produkte
│
└── projects/                           ← Projekt-Verzeichnisse
    ├── plc-security-assessment/        ← Git-Repo #2a: Projekt A
    │   ├── .git/
    │   ├── meta.yaml                   ← Projekt-Metadata (für Übersicht)
    │   ├── project-export.yaml         ← Kompletter Export (für DB-Import)
    │   ├── attacker-profiles/
    │   │   └── profile-<uuid>.yaml
    │   ├── goals/
    │   │   └── <goal-uuid>/
    │   │       ├── goal.yaml
    │   │       └── steps/
    │   │           └── <step-uuid>/
    │   │               ├── step.yaml
    │   │               ├── countermeasures/
    │   │               ├── weaknesses/
    │   │               └── substeps/
    │   ├── catalog-sources.yaml
    │   └── changelog.yaml
    └── scada-risk-review/              ← Git-Repo #2b: Projekt B
        └── ...
```

### Datenfluss

```
┌─────────────┐     git pull       ┌──────────────────┐
│  GitHub /    │ ◄───────────────── │  catalog-repo/   │
│  GitLab      │ ──────────────────►│  (lokale Kopie)  │
│  (remote)    │     git push       └────────┬─────────┘
└─────────────┘                              │ App liest beim Start
                                             ▼
                                    ┌──────────────────┐
                                    │  SQLite DB        │
                                    │  (Laufzeit)       │
                                    └────────┬─────────┘
                                             │ App schreibt
                                             ▼
┌─────────────┐     git push       ┌──────────────────┐
│  GitHub /    │ ◄───────────────── │  projects/       │
│  GitLab      │ ──────────────────►│  my-project/     │
│  (remote)    │     git pull       └──────────────────┘
```

---

## 3. Voraussetzungen

| Werkzeug | Version | Zweck |
|---|---|---|
| Docker Engine | ≥ 24.0 | Container-Laufzeit |
| Docker Compose | ≥ 2.20 | Multi-Container-Orchestrierung |
| Git | ≥ 2.30 | Versionierung (auf dem **Host**) |
| Browser | Chromium/Firefox | noVNC-Zugriff auf die App |

> **Kein Rust, Node.js oder sonstige Build-Tools auf dem Host nötig.** Alles wird im Docker-Image gebaut. Git wird innerhalb des Containers ebenfalls bereitgestellt.

---

## 4. Erstinstallation

### 4.1 Repository klonen und Image bauen

```bash
# 1. App-Repository klonen
git clone https://github.com/<your-org>/ics-threat-modeller.git
cd ics-threat-modeller

# 2. Docker-Image bauen (dauert beim ersten Mal ~3–5 Minuten)
docker compose build ics-threat-modeller

# 3. Container starten
docker compose up -d ics-threat-modeller
```

### 4.2 Zugriff

Öffne im Browser:

```
http://localhost:6080/vnc.html?autoconnect=true
```

Die Applikation läuft im Container mit virtuellem Display (Xvfb + noVNC). Kein X11 oder VcXsrv nötig.

### 4.3 Was passiert beim ersten Start?

1. Das Verzeichnis `/app/data/` wird im Docker-Volume `ics-data` persistiert.
2. Die App erstellt automatisch:
   - `/app/data/catalog-repo/catalog/` — 8 Default-Attack-Tree-Templates als YAML
   - `/app/data/catalog-repo/tag-catalog/` — 3 Tag-Katalog-Dateien (Assets, Interfaces, Software)
   - `/app/data/projects/` — leeres Verzeichnis für Projekt-Repos
3. Die YAML-Dateien werden in die SQLite-DB synchronisiert (Upsert by Name).
4. Log-Ausgabe bestätigt: `Catalog repo: synced 8 catalog + 78 tag entries from YAML files.`

### 4.4 Terminal-Zugriff in den Container

Für alle Git-Operationen brauchst du eine Shell im Container:

```bash
# Interaktive Shell öffnen
docker exec -it ics-threat-modeller bash

# Du bist jetzt in /app — wechsle zum Data-Verzeichnis:
cd /app/data
ls -la
# → catalog-repo/  ics_threat_modeller.db  projects/
```

> **Tipp:** Lass das Terminal-Fenster offen. Alle Git-Befehle in dieser Anleitung werden innerhalb des Containers ausgeführt.

---

## 5. Catalog-Repo einrichten

### 5.1 Option A: Eigenes Catalog-Repo von den Default-Daten erstellen

Falls du noch kein zentrales Catalog-Repo hast, initialisiere aus den generierten Default-Dateien:

```bash
# Im Container:
cd /app/data/catalog-repo

# Git initialisieren
git init
git add .
git commit -m "Initial catalog: 8 attack trees + 78 tag entries"

# Remote hinzufügen und pushen
git remote add origin git@github.com:<your-org>/ics-catalog.git
git push -u origin main
```

> **SSH-Key:** Falls du SSH nutzt, muss dein SSH-Key im Container verfügbar sein (siehe [Troubleshooting: SSH-Keys](#113-ssh-keys-im-container)).

### 5.2 Option B: Bestehendes Catalog-Repo klonen

Falls es bereits ein zentrales Repo gibt:

```bash
# Im Container:
cd /app/data

# Default-Verzeichnis entfernen und durch Git-Klon ersetzen
rm -rf catalog-repo
git clone git@github.com:<your-org>/ics-catalog.git catalog-repo
```

### 5.3 Option C: Vom mitgelieferten Beispiel starten

Im Projekt-Repository liegt ein Ordner `example-catalog-repo/` mit Beispiel-Dateien (3 Attack-Tree-Templates, vollständige Tag-Kataloge). Diesen kannst du als Basis für ein eigenes Catalog-Repo verwenden:

```bash
# Auf dem Host:
cp -r example-catalog-repo my-ics-catalog
cd my-ics-catalog
git init
git add .
git commit -m "Initial catalog from example template"
git remote add origin git@github.com:<your-org>/ics-catalog.git
git push -u origin main
```

Dann im Container:

```bash
cd /app/data
rm -rf catalog-repo
git clone git@github.com:<your-org>/ics-catalog.git catalog-repo
```

> Siehe `example-catalog-repo/README.md` für die vollständige Referenz der Dateiformate.

### 5.3 Catalog-Aktualisierung

Wenn jemand den Catalog aktualisiert hat:

```bash
# Im Container:
cd /app/data/catalog-repo
git pull origin main
```

Danach in der App auf der **Projects**-Seite den Button **🔄 Re-sync from Files** klicken. Alternativ: App neu starten — die Synchronisierung erfolgt automatisch beim Start.

> **Wichtig:** `git pull` ändert nur die YAML-Dateien auf Disk. Erst der Sync (Button oder Neustart) lädt die Änderungen in die SQLite-DB.

---

## 6. Projekt-Repo einrichten

### 6.1 Neues Projekt erstellen und speichern

1. In der App: **Projects → + New Project** → Name und Metadaten eingeben.
2. Im Projekt arbeiten: Attack Trees bauen, Assessments durchführen, etc.
3. Wenn bereit: **Project Settings → 💾 Save to Directory** klicken.
4. Die App schreibt das Projekt nach `/app/data/projects/<slug>/`.

```bash
# Im Container: Projekt-Verzeichnis als Git-Repo initialisieren
cd /app/data/projects/<slug>
git init
git add .
git commit -m "Initial threat model"

# Remote hinzufügen
git remote add origin git@github.com:<your-org>/project-<name>.git
git push -u origin main
```

### 6.2 Bestehendes Projekt-Repo klonen

```bash
# Im Container:
cd /app/data/projects
git clone git@github.com:<your-org>/project-plc-risk.git plc-risk
```

In der App auf der **Projects**-Seite erscheint das Projekt unter **📁 Project Directories**. Klicke **⬆ Load into DB** um es in die Datenbank zu importieren.

### 6.3 Änderungen speichern und pushen

Nach dem Arbeiten in der App:

1. **Project Settings → 💾 Save to Directory** — schreibt aktuelle Daten als YAML.
2. Im Terminal:

```bash
cd /app/data/projects/<slug>
git status                   # Zeigt geänderte Dateien
git diff                     # Review der Änderungen
git add .
git commit -m "Update: assessment for goal X completed"
git push origin main
```

### 6.4 Änderungen von Kollegen holen

```bash
cd /app/data/projects/<slug>
git pull origin main
```

Dann in der App: **Projects → 📁 Project Directories → ⬆ Load into DB**.

> **Achtung:** `Load into DB` überschreibt die Projektdaten in der SQLite-DB mit dem Inhalt von `project-export.yaml`. Sichere bei Bedarf vorher mit einem Snapshot (Versioning-Seite).

---

## 7. Tägliche Arbeit: Workflow-Beispiele

### 7.1 Solo-Workflow (ein Assessor)

```
1. docker compose up -d
2. Browser → http://localhost:6080/vnc.html?autoconnect=true
3. In der App arbeiten (Attack Trees, Assessments, etc.)
4. Project Settings → 💾 Save to Directory
5. Terminal:
   docker exec -it ics-threat-modeller bash
   cd /app/data/projects/<slug>
   git add . && git commit -m "Session: <datum> — <beschreibung>"
   git push origin main
```

### 7.2 Team-Workflow (mehrere Assessoren)

```
Assessor A:                              Assessor B:
─────────────────────                    ─────────────────────
1. git clone <project>                   1. git clone <project>
2. In App: Load into DB                  2. In App: Load into DB
3. Arbeitet an Goal X                    3. Arbeitet an Goal Y
4. Save to Directory                     4. Save to Directory
5. git add . && git commit && git push   5. git pull
                                         6. git add . && git commit && git push
```

> **Hinweis zur Konfliktvermeidung:**
> - Verschiedene Assessoren sollten an **unterschiedlichen Goals** arbeiten.
> - Die YAML-Dateien sind nach Entity-IDs (UUIDs) organisiert — parallele Änderungen an verschiedenen Goals/Steps erzeugen keine Merge-Konflikte.
> - Konflikte treten nur auf, wenn zwei Personen **dieselbe Datei** (z.B. `meta.yaml` oder denselben `step.yaml`) gleichzeitig ändern.

### 7.3 Review-Workflow mit Branches

```
# Feature-Branch für eine neue Bewertung erstellen
cd /app/data/projects/<slug>
git checkout -b assessment/goal-firmware-compromise

# In der App arbeiten...
# Save to Directory

git add .
git commit -m "Assessment: Firmware Compromise goal completed"
git push origin assessment/goal-firmware-compromise

# → Pull Request auf GitHub/GitLab erstellen
# → Reviewer prüft die YAML-Diffs
# → Nach Approval: Merge in main
```

---

## 8. Kollaboration über Branches & Pull Requests

### 8.1 Branch-Strategie

| Branch | Zweck | Wer |
|---|---|---|
| `main` | Finaler, agreed-upon Stand des Threat Models | Protected, merge only |
| `assessment/<goal>` | Bewertung eines einzelnen Goals | Lead Assessor |
| `review/<author>` | Review-Anmerkungen | Reviewer |

### 8.2 Pull Request Review

YAML-Diffs auf GitHub/GitLab sind gut lesbar:

```yaml
# Beispiel-Diff in step.yaml:
 step:
   name: "Physical Access Firmware Extraction"
-  access_level: 3
+  access_level: 4
 assessments:
 - time_effort: 4
-  prior_knowledge: 3
+  prior_knowledge: 5
+  rationale_json: '{"prior_knowledge": "Revised: requires vendor-specific documentation"}'
```

### 8.3 Merge-Konflikte auflösen

Falls ein Merge-Konflikt in einer YAML-Datei auftritt:

```bash
cd /app/data/projects/<slug>
git pull origin main
# → CONFLICT in goals/<uuid>/steps/<uuid>/step.yaml

# 1. Datei öffnen und Konflikte manuell resolven (vi, nano, oder per Host-Editor)
vi goals/<uuid>/steps/<uuid>/step.yaml

# 2. Konflikte auflösen, dann:
git add goals/<uuid>/steps/<uuid>/step.yaml
git commit -m "Resolve merge conflict in step assessment"

# 3. Alternativ: project-export.yaml neu generieren
#    → In der App: Load into DB → Manuell überprüfen → Save to Directory
```

---

## 9. Catalog-Repo erweitern

### 9.1 Neuen Attack-Tree-Template hinzufügen

Erstelle eine neue YAML-Datei in `catalog-repo/catalog/`:

```yaml
# catalog-repo/catalog/lateral-movement.yaml
name: Lateral Movement in OT Network
description: Attack tree for lateral movement techniques in OT environments.
entry_type: attack_tree
source_framework: MITRE ATT&CK for ICS
version: "1.0"
tags: []
tree_data:
  goal:
    name: Achieve Lateral Movement in OT
    description: Move from initial access point to critical control systems.
    aggregation_type: or
  steps:
    - name: Exploit Trust Relationships
      description: Abuse trust between IT and OT systems.
      is_leaf: true
      assessments:
        - factor_name: Elapsed Time
          factor_value: 3
          rationale: Depends on network segmentation quality.
      countermeasures:
        - name: Micro-Segmentation
          description: Fine-grained network segmentation between zones.
          effectiveness: 4
      technique_mappings:
        - technique_id: T0886
          technique_name: Remote Services
          source: MITRE ATT&CK for ICS
```

```bash
cd /app/data/catalog-repo
git add catalog/lateral-movement.yaml
git commit -m "Add: Lateral Movement attack tree template"
git push origin main
```

### 9.2 Tag-Katalog erweitern

Editiere die YAML-Dateien in `tag-catalog/`:

```yaml
# tag-catalog/assets.yaml — Eintrag hinzufügen:
- name: Safety PLC
  description: Safety-certified programmable logic controller (SIL-rated)
```

```bash
cd /app/data/catalog-repo
git add tag-catalog/assets.yaml
git commit -m "Add: Safety PLC asset type"
git push origin main
```

### 9.3 Änderungen an alle Teammitglieder verteilen

Jedes Teammitglied:

```bash
# Im Container:
cd /app/data/catalog-repo
git pull origin main
```

Dann in der App: **🔄 Re-sync from Files** auf der Projects-Seite, oder App-Neustart.

---

## 10. Verzeichnisstruktur-Referenz

### Catalog-Dateien

| Datei | Format | Beschreibung |
|---|---|---|
| `catalog/*.yaml` | YAML | Je ein Attack-Tree-Template mit Goals, Steps, Assessments, Countermeasures, Technique Mappings |
| `tag-catalog/assets.yaml` | YAML-Array | Asset-Typen (PLC, RTU, HMI, ...) |
| `tag-catalog/interfaces.yaml` | YAML-Array | Kommunikationsprotokolle (Modbus, OPC UA, ...) |
| `tag-catalog/third-party-software.yaml` | YAML-Array | Software-Produkte (TIA Portal, WinCC, ...) |

### Projekt-Dateien

| Datei/Verzeichnis | Format | Beschreibung |
|---|---|---|
| `meta.yaml` | YAML | Projekt-Metadaten (Name, Device Type, Interfaces, Assets, Factor Weights) |
| `project-export.yaml` | YAML | **Kompletter Projektstand** — wird von "Load into DB" verwendet |
| `attacker-profiles/` | YAML pro Profil | Angreiferprofile (Skill Level, Access Level, Tag) |
| `goals/<uuid>/goal.yaml` | YAML | Goal-Definition (Name, Impact Category, Impact Scores) |
| `goals/<uuid>/steps/<uuid>/step.yaml` | YAML | Step mit Assessments, Tags, Technique Mappings |
| `goals/<uuid>/steps/<uuid>/countermeasures/*.yaml` | YAML | Gegenmaßnahmen mit Effectiveness |
| `goals/<uuid>/steps/<uuid>/weaknesses/*.yaml` | YAML | Schwachstellen mit Severity, CVE-ID |
| `goals/<uuid>/steps/<uuid>/substeps/*.yaml` | YAML | Sub-Steps mit eigenen Assessments |
| `catalog-sources.yaml` | YAML | Referenzierte Catalog-Einträge |
| `changelog.yaml` | YAML | Änderungsprotokoll |

> **`project-export.yaml`** ist die **Single Source of Truth** für den DB-Import. Die individuellen YAML-Dateien (meta.yaml, goal.yaml, etc.) dienen der Lesbarkeit in Git-Diffs.

---

## 11. Troubleshooting

### 11.1 App startet nicht / weißer Bildschirm im Browser

**Symptom:** `http://localhost:6080` zeigt nichts oder einen schwarzen Bildschirm.

```bash
# Container-Status prüfen
docker ps -a | grep ics-threat-modeller

# Logs prüfen
docker logs ics-threat-modeller

# Typische Fehler:
# → "Failed to open database" → Volume-Berechtigungen (siehe 11.2)
# → "Xvfb" Fehler → Container neustarten
docker compose restart ics-threat-modeller
```

**Falls Port 6080 belegt:**

```bash
# Prüfe, was den Port blockiert
sudo lsof -i :6080

# Oder ändere den Port in docker-compose.yml:
# ports:
#   - "6081:6080"    ← Host-Port ändern
```

### 11.2 Volume-Berechtigungen

**Symptom:** `Permission denied` beim Schreiben in `/app/data/`.

```bash
# Berechtigungen im Container prüfen
docker exec ics-threat-modeller ls -la /app/data/

# Falls nötig: Berechtigungen korrigieren
docker exec ics-threat-modeller chmod -R 777 /app/data/

# Oder Volume komplett neu erstellen (ACHTUNG: Datenverlust!)
docker compose down -v
docker compose up -d ics-threat-modeller
```

### 11.3 SSH-Keys im Container

**Symptom:** `git push` / `git clone` über SSH schlägt fehl mit `Permission denied (publickey)`.

**Option A: SSH-Key ins Volume mounten** (empfohlen)

Füge in `docker-compose.yml` ein Volume hinzu:

```yaml
services:
  ics-threat-modeller:
    volumes:
      - ics-data:/app/data
      - ~/.ssh:/root/.ssh:ro             # SSH-Keys read-only mounten
```

```bash
docker compose down && docker compose up -d ics-threat-modeller
```

**Option B: SSH-Key im Container generieren**

```bash
docker exec -it ics-threat-modeller bash
ssh-keygen -t ed25519 -C "ics-threat-modeller"
cat ~/.ssh/id_ed25519.pub
# → Public Key auf GitHub/GitLab als Deploy Key hinterlegen
```

**Option C: HTTPS mit Token statt SSH verwenden**

```bash
# Im Container:
cd /app/data/catalog-repo
git remote set-url origin https://<token>@github.com/<org>/<repo>.git
```

### 11.4 Git-Konfiguration im Container

**Symptom:** `git commit` verlangt Name und E-Mail.

```bash
docker exec -it ics-threat-modeller bash
git config --global user.name "Max Mustermann"
git config --global user.email "max@example.com"
```

> **Hinweis:** Diese Konfiguration geht beim Container-Neustart verloren, wenn `/root` nicht persistiert wird. Füge optional ein Volume hinzu:
> ```yaml
> volumes:
>   - git-config:/root         # Persists .gitconfig
> ```

### 11.5 Catalog-Sync zeigt 0 Einträge

**Symptom:** Nach `git pull` und Re-Sync werden keine neuen Einträge geladen.

```bash
# Im Container: YAML-Dateien prüfen
ls -la /app/data/catalog-repo/catalog/
ls -la /app/data/catalog-repo/tag-catalog/

# Datei-Inhalt prüfen (muss valides YAML sein)
cat /app/data/catalog-repo/catalog/firmware-compromise.yaml | head -5

# Wichtig: Dateiendung muss .yaml oder .yml sein!
# Dateien ohne diese Endung werden ignoriert.
```

**Häufige Ursache:** Das Catalog-Repo wurde in ein Unterverzeichnis geklont:

```bash
# FALSCH: Doppelte Verschachtelung
/app/data/catalog-repo/ics-catalog/catalog/...

# RICHTIG: catalog/ direkt unter catalog-repo/
/app/data/catalog-repo/catalog/...
```

Fix:

```bash
# Falsche Struktur korrigieren
cd /app/data
rm -rf catalog-repo
git clone git@github.com:<org>/ics-catalog.git catalog-repo
# → Stellt sicher, dass catalog/ und tag-catalog/ direkt in catalog-repo/ liegen
```

### 11.6 "project-export.yaml not found" beim Laden

**Symptom:** `Load into DB` schlägt fehl.

Die Datei `project-export.yaml` wird nur durch **💾 Save to Directory** in der App erzeugt. Wenn das Projekt-Repo nur manuell erstellte YAML-Dateien enthält oder eine ältere Struktur hat:

```bash
# Prüfe, ob die Datei existiert
ls /app/data/projects/<slug>/project-export.yaml

# Falls nicht vorhanden: Projekt muss einmal in der App
# geöffnet und gespeichert werden (Save to Directory).
```

### 11.7 Merge-Konflikte in project-export.yaml

`project-export.yaml` ist eine große kombinierte Datei und erzeugt häufig Merge-Konflikte. **Empfohlener Umgang:**

```bash
# 1. Beide Seiten in die App laden und vergleichen ist der sicherste Weg.

# 2. Pragmatischer Ansatz: "Ours" / "Theirs" wählen, dann manuell korrigieren
git checkout --theirs project-export.yaml   # Version des Remotes übernehmen
git add project-export.yaml
git commit -m "Resolve: accept remote version of project-export.yaml"

# 3. Falls eigene Änderungen nicht verloren gehen sollen:
git stash                                    # Lokale Änderungen sichern
git pull origin main                         # Remote-Version holen
# → In App: Load into DB (Remote-Version)
# → Manuelle Nacharbeit in der App
# → Save to Directory (erzeugt neues project-export.yaml)
git add . && git commit && git push
```

### 11.8 Container-Neustart verliert Änderungen nicht

Docker-Volumes persistieren über Neustarts:

```bash
# Sicher: Volume bleibt erhalten
docker compose restart ics-threat-modeller
docker compose down && docker compose up -d

# UNSICHER: Volume wird gelöscht!
docker compose down -v    # ← -v löscht alle Volumes!
```

### 11.9 Datenbank zurücksetzen

Falls die DB korrupt ist oder du von vorne starten willst:

```bash
# Im Container:
rm /app/data/ics_threat_modeller.db

# Dann Container neustarten — DB wird automatisch neu erstellt
docker compose restart ics-threat-modeller

# Die App synchronisiert die Catalog-Daten aus den YAML-Dateien.
# Projekte müssen über "Load into DB" neu geladen werden.
```

### 11.10 Bildschirmauflösung anpassen

```yaml
# docker-compose.yml
environment:
  - SCREEN_WIDTH=1920     # Default: 1400
  - SCREEN_HEIGHT=1080    # Default: 900
```

```bash
docker compose down && docker compose up -d ics-threat-modeller
```

### 11.11 VNC-Zugriff mit Passwort absichern

```yaml
# docker-compose.yml
environment:
  - VNC_PASSWORD=mein-passwort
```

```bash
docker compose down && docker compose up -d ics-threat-modeller
```

### 11.12 Mehrere Instanzen parallel betreiben

Für mehrere Assessoren auf demselben Host:

```bash
# Assessor A:
COMPOSE_PROJECT_NAME=assessor-a docker compose -f docker-compose.yml up -d
# → Port 6080

# Assessor B (anderen Port nutzen):
# Erstelle docker-compose.override.yml oder nutze -p flag:
docker run -d --name ics-assessor-b \
  -p 6081:6080 \
  -v assessor-b-data:/app/data \
  ics-threat-modeller-ics-threat-modeller
# → Port 6081
```

> Jede Instanz hat ihr eigenes Volume und damit eigene Datenbank, Catalog-Repo und Projekt-Verzeichnisse.
