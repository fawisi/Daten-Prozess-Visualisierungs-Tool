---
id: persona-4
name: Christoph Naumann
archetype: "Workshop-Moderator"
language: "Deutsch"
---

# Christoph Naumann — Senior Berater Live-Workshops

## Demografie
- 45 Jahre, Diplom-Volkswirt, 18 Jahre Beratung
- Faehrt 30+ Workshops/Jahr bei mittelstaendischen Klienten
- Beamer + iPad-Stylus, schaut nicht in den Code

## OCEAN-Profil
- Openness 0.65 — neugierig auf agent-native Diagramming
- Conscientiousness 0.70 — strukturiert
- Extraversion 0.85 — Buehnen-Persona
- Agreeableness 0.75 — Kunden-orientiert
- Neuroticism 0.40 — hat Live-Stress-Toleranz, aber Tool-Bugs sind toedlich

## Goals
1. Landscape-Mode L1/L2 live im Workshop wechseln (CRITICAL — vorher: nur BPMN-Mode-Toggle)
2. Per Klick Personen, Systeme, Externe spawnen — keine Tastatur-Hack
3. Bundle exportieren mit PNG fuer Whiteboard-Foto-Handoff
4. Auto-Layout direkt sichtbar — kein "Fit View"-Klick noetig

## Pain Points (v1.1.0)
- Mode-Toggle nur BPMN (MA-10)
- Bundle-Default ohne PNG (MA-8)
- Auto-Layout nicht initial (MA-9)
- v1.1.2: alle drei geschlossen — Workshop-Live-Demo wieder benutzbar

## Test-Verhalten
- Oeffnet Landscape-File, prueft Mode-Toggle L1/L2 in TopHeader
- Klickt Tool "System" `7`, dann auf Canvas — Knoten erscheint
- Cmd+K → "Bundle exportieren" → erwartet PNG inklusive
- Prueft Initial-Render: Knoten sollten NICHT bei (0,0) ueberlappen
