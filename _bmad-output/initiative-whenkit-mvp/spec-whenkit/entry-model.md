# Modelul intrărilor

## Feluri de intrări

| Fel | Zonă | Ce este | Link |
|---|---|---|---|
| unealtă | Toolbox | ce folosesc ca să **fac** X (remove.bg, ComfyUI, public-apis) | obligatoriu |
| material | Learn | ce citesc/studiez ca să **înțeleg** X (system-design-primer, roadmaps, free books) | obligatoriu |
| concept | Learn | notiță de cunoștințe (REST, RPC); poate fi **umbrelă** (ex. „Tipuri de API”) | opțional |

Zona rezultă din fel.

## Câmpuri

**Comune**

| Câmp | Scris de | Note |
|---|---|---|
| `id` | aplicația | |
| `owner_id` | aplicația | un singur utilizator acum |
| fel | Claude | unealtă / material / concept |
| nume | Claude | numele original al resursei |
| categorii | Claude | 1–2, din lista zonei |
| ce face | Claude | 2–3 propoziții |
| Când o folosesc (unealtă, material) / Când îl aleg (concept) | Claude | listă de 3–6 situații |
| cuvinte-cheie | Claude | RO + EN, sinonime |
| resurse înrudite | Claude | legături către intrări existente |
| Notițele mele | **doar utilizatorul** | Claude nu le suprascrie niciodată |
| adăugat la | aplicația | |
| verificat la | aplicația | |
| notă de verificare | Claude + aplicația | constatări; „verificare ocolită de utilizator” la `--force` |

**Unealtă și material:** link; tip (repo / site / aplicație); pentru repo GitHub: stele, data ultimului commit, arhivat.

**Concept:** conținut (Markdown, inclusiv tabele); surse (linkuri); link opțional. Umbrela are în plus legături spre conceptele-copil. „Umbrelă” și „copil” sunt termenii tehnici (spec, CLI, skill-uri); fereastra și exportul spun **colecție** („colecție · N concepte” pe card, „Face parte din” pentru părinți).

**Scoase intenționat:** Nivel, Status (revine cu re-verificarea), Sursă (fișierul de input se șterge după import).
