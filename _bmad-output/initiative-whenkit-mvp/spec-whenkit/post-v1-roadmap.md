# După v1

Nu se implementează în MVP. Listate pentru că arhitectura nu trebuie să le blocheze.

| Funcție | Ce înseamnă | Ce cere arhitecturii acum |
|---|---|---|
| Re-verificare (obligatorie pe roadmap) | Refresh manual per resursă + refresh automat configurabil în Setări: activ da/nu, interval, notificare că durează. Câmp Status (activ / nu răspunde / arhivat) afișat ca insignă. **Nu șterge niciodată, doar marchează.** Judecata de conținut rămâne la Claude, la cerere | modulul de verificare rulează și pe intrări existente; CLI `whenkit verifica` |
| Claude Code în aplicație (open-source) | Butoane generice („Importă”, „Caută”) care rulează `claude -p` headless și arată progresul; terminal integrat pentru utilizatori tehnici | stack-ul permite pornirea de procese locale și PTY; server intern doar pe localhost |
| Configurare inițială de limbă (open-source) | Fiecare utilizator alege limba UI și a fișelor | textele UI deja într-un singur fișier |
| Documentație în engleză (open-source) | Traducerea README-ului și a documentației | codul e deja integral în engleză |
| Google Safe Browsing | Detectare malware/phishing | verificarea extensibilă cu surse noi |
| `/rescrie` | Re-documentarea fișelor după reguli noi, păstrând Notițele mele | — (doar dacă cererea apare des) |
| Quiz / Learn interactiv | Testare, explicații pe concepte | — |
| Căutare semantică | Embeddings (local sau API) | — |
| Graph view | Hartă vizuală a legăturilor | legăturile dintre intrări sunt deja modelate |
| Versiune publică | Conturi, hosting | `owner_id` deja în model |
