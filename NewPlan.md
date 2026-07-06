# VibeShell v2 — OpenCode Client + Yan Terminal Planı

**Pivot:** Kendi agent loop'unu yazmak yerine, app doğrudan `opencode serve`'e bağlanan bir client olacak. Chat = OpenCode session'ı. Yanında da aynı çalışma dizininde ham bir terminal (npm start, git vs. için).

---

## 1. Neden Bu Daha İyi

- Agent loop, tool-use parsing, context yönetimi gibi en zor mühendislik işini artık **OpenCode kendi üstleniyor** — sen bunu yeniden yazmıyorsun
- OpenCode zaten 75+ provider destekliyor, model seçimi ücretsiz geliyor
- OpenCode'un server'ı **OpenAPI 3.1 spec** yayınlıyor — SDK üretimi veya doğrudan HTTP çağrısı ile client yazmak kolay
- Kendi bridge server'ının (exec/read_file/write_file) sorumluluğu artık sadece **terminal paneli** için kalıyor — çok daha küçük, daha az bakım yükü

---

## 2. Hedef Mimari

```
┌─────────────────────────────────────────────────────┐
│                  Telefon (RN/Expo App)                 │
│                                                           │
│  ┌───────────────┐        ┌─────────────────────┐    │
│  │   Chat paneli   │        │   Terminal paneli     │    │
│  │  (OpenCode UI)  │        │  (ham shell/xterm)    │    │
│  └───────┬───────┘        └──────────┬───────────┘    │
│          │ HTTP/SSE                    │ WebSocket        │
└──────────┼──────────────────────────────┼─────────────────┘
           ▼                              ▼
┌─────────────────────┐      ┌──────────────────────────┐
│  opencode serve        │      │  VibeShell bridge (mevcut) │
│  --hostname 127.0.0.1  │      │  - exec (PTY destekli)     │
│  --port 4096            │      │  - aynı cwd'de çalışır     │
│  OpenAPI + /tui + /event│      │                              │
└─────────────────────┘      └──────────────────────────┘
           │                              │
           └──────────────┬───────────────┘
                           ▼
              Aynı proje dizini (aynı proot/Termux rootfs)
```

**Kritik nokta:** İki backend process aynı ortamda (aynı proot rootfs veya Termux home) ve **aynı çalışma dizininde** çalışıyor. Chat'te OpenCode bir dosya değiştirdiğinde, terminal panelinde `git status`/`npm start` çalıştırdığında aynı dosyaları görüyor olman lazım.

---

## 3. Chat Paneli — OpenCode Client Detayları

### 3.1 Bağlantı
- App açılışta `opencode serve --hostname 127.0.0.1 --port 4096` process'ini başlatıyor (proot/Termux içinde)
- <cite index="5-1">Server, `--cors` flag'i ile CORS ayarlanabiliyor, auth için `OPENCODE_SERVER_PASSWORD` ortam değişkeni ile HTTP basic auth ekleniyor</cite> — bunu mutlaka aç, localhost olsa da
- App, OpenAPI spec'ini (`http://localhost:4096/doc`) kullanarak ya generate edilmiş bir TS client ile ya da doğrudan fetch ile konuşuyor

### 3.2 Session yönetimi
- Her workspace/proje için ayrı bir OpenCode session
- <cite index="9-1">OpenCode'un "Plan" agent'ı dosya düzenleme ve bash komutlarını varsayılan olarak sorup onay alan, salt-okunur analiz/planlama için tasarlanmış bir agent; "General" ise tam tool erişimli, çok adımlı görevler için</cite> — bu ikisini UI'da net şekilde ayır: "Plan modu" ve "Build modu" gibi iki sekme/toggle
- Model seçimi: OpenCode zaten `--model provider/model` formatını destekliyor, kullanıcı ayarlarda bunu seçiyor, API key'i OpenCode'un kendi auth mekanizmasına (`opencode auth login` veya env var) yazıyorsun

### 3.3 Streaming
- OpenCode'un `/event` gibi bir SSE endpoint'i olduğu görülüyor (TUI'yi bu şekilde sürüyor) — chat mesajlarını, tool call'ları, diff'leri buradan canlı akıt
- Diff/patch gösterimi: OpenCode zaten dosya değişikliklerini kendi formatında sunuyor, sen bunu native diff viewer komponentine map ediyorsun (renk kodlu +/- satırlar)

### 3.4 Onay akışı
- Plan agent'ta dosya/komut değişiklikleri onay bekliyor — bu onay isteğini push notification + in-app modal ile göster (kullanıcı app'i arka plana alsa bile bildirim gelsin)

---

## 4. Terminal Paneli — Mevcut Bridge'in Küçültülmüş Hali

- Artık `read_file`/`write_file`/`git_diff`/`git_commit` metodlarına gerek kalmıyor — bunları OpenCode zaten yapıyor
- Bridge server sadece **PTY destekli exec** için kalıyor: kullanıcı `npm start`, `npm run dev`, `adb logcat` gibi uzun süren/interaktif komutları çalıştırabilsin
- `node-pty` kullan (mevcut `child_process.spawn` yerine) — gerçek terminal deneyimi (renk kodları, interaktif prompt'lar, Ctrl+C ile kill) için şart
- RN tarafında xterm.js'i react-native-webview içine göm, WebSocket üzerinden stdin/stdout stream et

```javascript
// bridge server'a eklenecek: PTY-based exec
const pty = require('node-pty');
const term = pty.spawn('bash', [], { cwd, cols: 80, rows: 24 });
term.onData((data) => send(ws, { id, stream: 'pty', data }));
// client'tan gelen input:
term.write(inputFromClient);
```

---

## 5. Aynı Ortamda İki Process Çalıştırma

| Konu | Çözüm |
|---|---|
| İkisi de aynı proot rootfs'te mi? | Evet — `opencode` binary'sini de rootfs içine kur (Node.js üzerinden `npm i -g opencode-ai` veya prebuilt binary indir) |
| Port çakışması | `opencode serve` 4096, bridge 8765 — sabit ve farklı tut |
| Başlangıç sırası | Foreground service ikisini de sırayla spawn etsin: önce opencode serve, health-check (`/doc` endpoint'ine ping) başarılı olunca bridge'i başlat |
| Kaynak tüketimi | İki Node.js process + OpenCode'un kendisi (Go/TS karışık) aynı anda RAM tüketiyor — düşük RAM cihazlarda test şart, gerekirse tek process'te ikisini birleştirme (bridge'i opencode'un bir plugin'i gibi çalıştırma) düşünülebilir ileride |

---

## 6. Arka Plan Kalıcılığı — Önceki Plan Hâlâ Geçerli

Önceki proot/foreground-service planı burada da aynen uygulanıyor, tek fark artık **iki process'i** ayakta tutman gerekiyor:

- `BridgeForegroundService` artık hem `opencode serve` hem bridge server'ı spawn edip `START_STICKY` ile ayakta tutuyor
- Her iki process için de crash durumunda otomatik restart mantığı (basit bir "process öldüyse tekrar spawn et" loop'u, 3-5 saniyede bir health-check)
- Battery optimization whitelist isteği aynen geçerli

---

## 7. Fazlar (Güncellenmiş)

### Faz 1 — OpenCode server'ı ortama kurulum
- [ ] Proot rootfs'e Node.js + `opencode-ai` npm paketini önceden göm
- [ ] `opencode serve --hostname 127.0.0.1 --port 4096 --cors *` komutunun proot içinde çalıştığını doğrula
- [ ] `OPENCODE_SERVER_PASSWORD` ile auth ekle, RN tarafından basic auth header'ı ile bağlan

### Faz 2 — Chat client
- [ ] OpenAPI spec'ten TS tipleri çıkar (veya elle önemli endpoint'leri map et: session oluştur, mesaj gönder, event stream'e abone ol)
- [ ] SSE/event endpoint'ine bağlan, mesaj/tool-call/diff event'lerini chat UI'a bas
- [ ] Model seçimi ve Plan/Build agent toggle'ı ekle
- [ ] Diff viewer + onay modalı

### Faz 3 — Terminal paneli
- [ ] Bridge server'ı sadeleştir (PTY-only exec)
- [ ] `node-pty` entegrasyonu, WebSocket stream
- [ ] RN tarafında xterm.js (webview) ile terminal render

### Faz 4 — Süreç orkestrasyon ve kalıcılık
- [ ] Foreground service: iki process'i sırayla başlat, health-check, crash-restart
- [ ] Battery whitelist + OEM onboarding (önceki plandan aynen taşı)

### Faz 5 — Test ve cilalama
- [ ] Düşük RAM cihazda iki process'in birlikte davranışı
- [ ] Uzun session'larda OpenCode'un kendi context yönetimi yeterli mi gözlemle (muhtemelen kendi çözümü var, senin ek bir şey yapman gerekmeyebilir)
- [ ] Workspace/session geçmişi local'de nasıl saklanıyor incele — muhtemelen OpenCode kendi tarafında persist ediyor, sen sadece hangi session'a hangi workspace'in bağlı olduğunu tutuyorsun

---

## 8. Riskler / Açık Sorular

- **OpenCode server'ın mobil/ARM ortamda (proot içinde) stabil çalışıp çalışmadığı doğrulanmalı** — resmi olarak masaüstü/sunucu hedefli, proot'un syscall interception'ı ile uyumluluğu test edilmeli
- **SSE bağlantısının arka planda (app minimize) kopma davranışı** — foreground service olsa bile WebView/fetch tabanlı SSE bağlantısı Android'de app arka plana alınca kesilebilir, native bir SSE client (OkHttp) daha güvenilir olabilir
- **OpenCode sürüm değişiklikleri** — proje çok hızlı büyüyor <cite index="9-1">2026 ortasında 150.000 GitHub yıldızına ve 6.5 milyon aylık aktif geliştiriciye ulaştı</cite>, API'de kırıcı değişiklik riski var, versiyon pinlemek gerekebilir

---

## 9. Sonraki Somut Adım

Önce izole bir deney: proot rootfs içinde `opencode serve` çalıştırıp OpenAPI spec'e (`/doc`) telefondan bir HTTP client ile erişebiliyor musun test et. Bu çalışırsa mimarinin en riskli parçası (OpenCode'un proot/ARM'de stabilitesi) doğrulanmış olur, sonrasında chat client ve terminal panelini paralel geliştirebilirsin.