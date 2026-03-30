---
date: 2026-03-30
topic: daten-prozess-visualisierung
---

# Daten & Prozess Visualisierungs-Tool

## Was wir bauen

Ein lokales, Agent-natives Tool zur Visualisierung von Datenbank-Relationen und Geschaeftsprozessen. Der primaere Zugang ist ein MCP-Server und CLI — AI-Agents koennen Schemas erstellen, lesen, modifizieren und abfragen. Ein Browser-basierter visueller Editor dient als Live-Preview und erlaubt manuelle Bearbeitung.

**Kern-Metapher:** Wie Pencil.dev, aber fuer Datenstrukturen statt UI-Design. Maschinenlesbar, visuell ansprechend, lokal und datenschutzkonform.

## Warum dieser Ansatz

### Betrachtete Alternativen

| Ansatz | Verworfen weil |
|--------|----------------|
| Eraser.io-Klon (Cloud-first, AI-native) | Cloud-only, kein MCP, keine lokale Kontrolle |
| Mermaid-Wrapper (bestehendes Format verbessern) | Visuell zu limitiert, Layout-Kontrolle fehlt |
| D2-Extension (auf D2-Oekosystem aufbauen) | Zu wenig LLM-Training-Data, kein ER+Prozess-Kombi |
| Visueller Editor first (wie Excalidraw) | Zu lange bis MVP, MCP ist der Differentiator |

### Gewaehlter Ansatz: MCP/CLI-first mit eigenem internem Format

- **MCP-Server ist das Haupt-Interface.** LLMs interagieren ueber strukturierte Tool-Calls (`create_table`, `add_relation`, `query_schema`), nicht direkt mit dem Dateiformat.
- **Eigenes internes Format** fuer volle Kontrolle ueber Rendering und Features.
- **Import/Export** von Mermaid und D2 fuer Interoperabilitaet.
- **Browser-basierter Preview** mit Hot-Reload. Spaeter Tauri-Wrap fuer native App.

## Marktpositionierung

### Die Luecke

Kein existierendes Tool vereint: **Local-first + Agent-native (MCP) + visuell ansprechend + ER-Diagramme + Prozesse.**

- Eraser.io ist am naechsten, aber cloud-only und ohne MCP/CLI
- Mermaid hat die beste LLM-Affinitaet, aber sieht schlecht aus
- Excalidraw ist lokal und schoen, aber nicht maschinenlesbar
- dbdiagram.io kann nur ER, kein AI, kein MCP

### Zielgruppen

1. **Primaer: Entwickler die mit AI-Agents arbeiten** (Claude Code, Cursor, etc.) — brauchen ein Tool das ihr Agent lesen/schreiben kann
2. **Sekundaer: Tech-Teams im deutschen Mittelstand** — DSGVO-konform, ersetzt Lucidchart + dbdiagram.io
3. **Teriaer: Datenschutzbeauftragte** — Automatisierte Datenfluss-Dokumentation (DSGVO Art. 30)

### Zahlungsbereitschaft

- Entwickler/Agenturen: EUR 0-15/Monat (Freemium)
- Tech-Teams: EUR 20-50/User/Monat
- Compliance: EUR 50-100/Monat

## Key Decisions

- **MCP/CLI-first, visueller Editor zweitrangig:** Agent-native ist der Differentiator, nicht die UI
- **Eigenes internes Format + Mermaid/D2 Import/Export:** MCP-Tools sind die Abstraktionsschicht, Format ist Implementierungsdetail
- **Browser-basierter Preview fuer MVP:** Lokaler Dev-Server mit Hot-Reload, spaeter Tauri-Wrap
- **TypeScript/Node Stack:** Ein Oekosystem fuer MCP-Server, CLI, Preview-Server und Rendering
- **Datenstruktur ist der Kern, Prozesse sind Erweiterung:** ER-Diagramme zuerst, BPMN/Prozessflows als natuerlicher naechster Schritt
- **Bidirektionale AI-Interaktion:** Agent kann lesen UND schreiben UND modifizieren UND abfragen

## Use Cases (primaer)

1. **Datenstruktur konzipieren:** "Erstelle ein Schema fuer eine E-Commerce App mit Users, Orders, Products" → Agent erstellt via MCP, Preview zeigt es live
2. **Bestehende Strukturen verstehen:** Agent liest Schema, beantwortet Fragen ("Welche Tabellen haengen am User?", "Zeig mir alle Many-to-Many Relations")
3. **Schema iterativ entwickeln:** "Fuege eine Tabelle Reviews hinzu mit FK zu Users und Products" → Agent modifiziert, Preview aktualisiert
4. **Externe Datenstrukturen analysieren:** Import von SQL DDL, Mermaid oder D2 → Visualisierung + AI-Analyse

## Open Questions

- Welches Canvas/Rendering-Framework? (React Flow, D3, Konva, eigenes?)
- Dateiformat: JSON-basiert wie Excalidraw oder kompakter?
- Soll der Preview-Server auch ohne MCP nutzbar sein (standalone)?
- Lizenzmodell: MIT/Apache fuer Core, Commercial fuer Cloud?
- Name des Produkts?

## Next Steps

→ `/workflows:plan` fuer technische Implementierung des MVP
