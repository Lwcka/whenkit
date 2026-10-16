# Ecranele v1

Inventarul ecranelor: ce există în v1 și ce lipsește intenționat. Aspectul e în `../ux-whenkit/DESIGN.md`, comportamentul (stări, fluxuri, tastatură, animații) în `../ux-whenkit/EXPERIENCE.md`; schița de mai jos arată doar structura.

```
┌───────────────────────────────────────────────────────┐
│  [ Toolbox ]  [ Learn ]                  🔍 caută...  │
├───────────────────────────────────────────────────────┤
│ ◀ Toate · Imagini & video · Design & UI · AI & LLM ▶ │  ← bara de categorii
├───────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│ │ remove.bg   │ │ squoosh     │ │ photopea    │       │
│ │ Elimină     │ │ Comprimă    │ │ Editor tip  │       │  ← carduri
│ │ fundalul... │ │ imagini...  │ │ Photoshop...│       │
│ │ • vreau să  │ │ • vreau să  │ │ • vreau să  │       │
│ │   scot fun- │ │   micșorez  │ │   editez un │       │
│ └─────────────┘ └─────────────┘ └─────────────┘       │
└───────────────────────────────────────────────────────┘
       click pe card → fișa completă
```

1. **Tab-uri Toolbox / Learn**, fiecare cu bara lui de categorii (glisabilă) și caseta de căutare text.
2. **Lista de carduri:** nume, „ce face”, primele 1–2 situații; în Learn și felul (concept/material).
3. **Fișa completă:** toate câmpurile, Markdown cu tabele pentru concepte, legături navigabile spre intrările înrudite / copii; editare, ștergere, „Notițele mele” editabile direct.
4. **Gestionarea categoriilor:** redenumire, unificare, ștergere.
5. **Buton de export** al întregului catalog, cu alegerea locației.
6. **Comutator temă** luminoasă / întunecată, direct în fereastră (nu e ecran de Setări).
7. **Notificare discretă** când un import aduce fișe noi, oriunde ești în fereastră.

Fereastra pornește mereu pe Toolbox → Toate.

Lipsesc intenționat: formular de adăugare sau captură rapidă, ecran de Setări, ecran de respinse (raportul și jurnalul acoperă asta). Ce lipsește la folosire se adaugă ulterior (vezi `post-v1-roadmap.md`).
