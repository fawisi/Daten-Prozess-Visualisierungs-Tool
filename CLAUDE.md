# Daten & Prozess Visualisierungs-Tool

## Arbeitsregeln

### Git-Workflow (strikt)
- **Jeder Arbeitsschritt wird committet.** Keine langen uncommitted Aenderungen.
- Feature-Branches fuer neue Features, `main` bleibt stabil.
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Vor jedem groesseren Schritt: `git status` pruefen, sauberer Stand sicherstellen.
- Kein `--force`, kein `--no-verify` ohne explizite Anweisung.

### Proaktives Arbeiten
- Nicht auf Anweisungen warten, wenn der naechste Schritt offensichtlich ist.
- Probleme frueh erkennen und ansprechen, bevor sie eskalieren.
- Tests, Linting und Build-Checks proaktiv ausfuehren nach Aenderungen.
- Verbesserungsvorschlaege aktiv einbringen, wenn sie zum Scope passen.

### Compound Engineering Plugin
- **Immer befolgen.** Alle verfuegbaren Compound Engineering Workflows und Skills nutzen.
- **Planung:** `compound-engineering:workflows:plan` fuer Feature-Planung verwenden.
- **Reviews:** `compound-engineering:workflows:review` fuer Code-Reviews einsetzen.
- **Wissen dokumentieren:** `compound-engineering:workflows:compound` nach geloesten Problemen nutzen.
- **Brainstorming:** `compound-engineering:brainstorming` vor groesseren Entscheidungen.
- **Spezialisierte Agents:** Review-Agents (Rails, TypeScript, Security, Performance etc.) kontextabhaengig einsetzen.
- **Parallel arbeiten:** Unabhaengige Aufgaben mit parallelen Agents bearbeiten.

## Qualitaetsstandards
- Code-Aenderungen werden durch spezialisierte Review-Agents geprueft.
- Performance und Security sind keine Nachgedanken, sondern Teil jedes Features.
- Dokumentation entsteht mit dem Code, nicht danach.
