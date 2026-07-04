# Mobil Vibe Coding App — Proje Planı

**Konsept:** Android üzerinde, Termux tabanlı, kullanıcının kendi API key'i ile çalışan açık kaynak bir agentic coding client. Claude Code / OpenCode'un mobildeki karşılığı.

---

## 1. Ürün Vizyonu

- **Platform:** Android only (Termux bağımlılığı nedeniyle)
- **Lisans:** Açık kaynak (GPL-3.0 öneriliyor — FocusBuddy tecrübenle tutarlı)
- **Dağıtım:** F-Droid + GitHub Releases (Play Store hedeflenmiyor, Termux zaten orada yok)
- **Hedef kullanıcı:** Telefonundan hızlı prompt atıp kod ürettirmek/düzenletmek isteyen developer/hobbyist
- **Farklılaştırıcı:** Gerçek shell + gerçek dosya sistemi + gerçek git — sadece "chat with code" değil, gerçek agent loop

---

## 2. Mimari Genel Bakış

```
┌─────────────────────────────────────────┐
│           RN/Expo App (Client)           │
│  - Chat UI                                │
│  - Agent loop (Claude API + tool use)     │
│  - Diff viewer, dosya ağacı, terminal UI  │
│  - Ayarlar: API key, model seçimi         │
└───────────────┬───────────────────────────┘
                │ WebSocket (localhost:8765)
                ▼
┌─────────────────────────────────────────┐
│     Termux — Node.js Bridge Server        │
│  - exec (shell komutları)                 │
│  - read_file / write_file / list_dir      │
│  - git işlemleri                          │
│  - stdout/stderr stream                   │
└───────────────┬───────────────────────────┘
                ▼
        Gerçek Linux userland
     (bash, node, python, git, npm...)
```

**Kritik prensip:** Agent loop (Claude API'ye prompt gönderme, tool_use parse etme, konuşma state'i) tamamen RN/JS tarafında. Termux sadece "execution backend" — dosya ve komut işlemlerini yapan dilsiz bir işçi.

---

## 3. Bileşenler Detayı

### 3.1 RN/Expo App

| Modül | Açıklama |
|---|---|
| **Onboarding** | Termux/Termux:API kurulu mu kontrolü, kurulu değilse F-Droid linkine yönlendirme, bridge server kurulum scripti (kopyala-yapıştır veya deep link) |
| **Ayarlar** | API key girişi (Expo SecureStore ile şifreli sakla), provider seçimi (Anthropic/OpenAI/OpenRouter), model seçimi, sistem prompt özelleştirme |
| **Workspace yönetimi** | Proje listesi, her biri bir Termux dizinine bağlı (`~/projects/xxx`), git clone/pull/init desteği |
| **Chat ekranı** | Prompt gir, agent'ın tool call'larını canlı göster (örn. "📁 dosya okunuyor: App.tsx", "⚙️ komut çalıştırılıyor: npm install") |
| **Diff viewer** | Her write_file/patch işleminden önce diff göster, onayla/reddet/düzenle seçeneği |
| **Terminal görünümü** | Ham stdout/stderr stream'i isteyen kullanıcı için (xterm.js benzeri, react-native-webview içinde) |
| **Dosya gezgini** | Read-only ağaç görünümü + syntax highlight'lı içerik görüntüleme |
| **Bildirimler** | Uzun süren task bitince push notification (expo-notifications) — mobilin CLI'a karşı en büyük avantajı |

### 3.2 Termux Bridge Server (Node.js)

- WebSocket server, tek dosyalık basit bir servis
- Desteklenen komutlar: `exec`, `read_file`, `write_file`, `list_dir`, `delete_file`, `git_*`
- `termux-wake-lock` ile arka planda düşmemesi
- Boot'ta otomatik başlama (Termux:Boot eklentisi ile)
- Basit bir auth token (localhost olsa da, aynı ağdaki başka cihazlardan erişimi engellemek için)

### 3.3 Agent Loop

- Claude API'ye system prompt + tool tanımları ile istek
- Tool şeması (öneri):
  - `run_command(command, cwd)`
  - `read_file(path)`
  - `write_file(path, content)`
  - `list_dir(path)`
  - `apply_patch(path, diff)` — diff-based edit, tam dosya yazmaktan daha güvenli/tokensiz
  - `git_diff()`, `git_commit(message)`
- Multi-turn loop: tool_result'ları context'e ekleyip tekrar Claude'a gönder, `stop_reason: end_turn` gelene kadar devam
- Context window yönetimi: uzun session'larda eski tool result'ları özetle/budala (Claude Code'un yaptığı gibi)

---

## 4. Kurulum Akışı (Kullanıcı Deneyimi)

1. Kullanıcı APK'yı kurar (F-Droid veya GitHub Releases)
2. App açılır → "Termux gerekli" ekranı → F-Droid'den Termux + Termux:API kurma linki
3. Kullanıcı Termux'u açar, app'in verdiği tek satır kurulum komutunu yapıştırır:
   ```bash
   curl -sL https://.../install-bridge.sh | bash
   ```
4. Script: Node.js kurar, bridge server'ı indirir, `termux-services` ile arka plan servisi olarak kaydeder
5. App otomatik `ws://localhost:8765`'e bağlanmayı dener → "✅ Termux bağlandı"
6. Kullanıcı API key girer, model seçer, ilk workspace'ini oluşturur
7. Chat ekranından prompt yazmaya başlar

---

## 5. Geliştirme Fazları

### Faz 0 — Prototip (1-2 hafta)
- Bridge server'ın minimal versiyonu (sadece exec + read/write file)
- RN tarafında WebSocket bağlantısı + basit chat UI
- Tek bir hardcoded workspace ile "prompt → dosya oluştur" akışını uçtan uca çalıştır

### Faz 1 — MVP
- API key + model seçimi ayarları
- Gerçek agent loop (tool use, multi-turn)
- Diff viewer + onay akışı
- Workspace yönetimi (birden fazla proje)
- Kurulum onboarding akışı

### Faz 2 — Kullanılabilirlik
- Terminal stream görünümü
- Dosya gezgini + syntax highlight
- Git entegrasyonu (commit/push, PR açma — GitHub API ile)
- Background task + push notification
- Session geçmişi (SQLite ile local persistence — DayShot'taki pattern)

### Faz 3 — Cilalama / Topluluk
- Çoklu provider desteği (OpenRouter ile model çeşitliliği)
- Özelleştirilebilir sistem promptları / agent "personaları" (senin bug bounty KB'deki SKILL.md fikrine benzer şekilde, kullanıcı kendi agent kimliklerini tanımlayabilir)
- Termux kurulum scriptini otomatikleştirme (RUN_COMMAND intent ile tek tıkla kurulum)
- README + katkı rehberi, F-Droid metadata

---

## 6. Riskler ve Dikkat Edilecekler

| Risk | Notlar |
|---|---|
| **Termux bağımlılığı UX sürtünmesi** | Kurulum adımı teknik olmayan kullanıcı için ürkütücü olabilir — onboarding'e çok yatırım yap, video/gif rehber ekle |
| **Arka planda ölme (battery optimization)** | Android'in agresif battery optimization'ı Termux servisini öldürebilir — kullanıcıya "battery optimization'dan çıkar" talimatı ver |
| **Güvenlik** | Bridge server localhost'ta olsa da, aynı Wi-Fi ağındaki cihazlardan erişim riski — bind adresini `127.0.0.1` ile sınırla, token auth ekle |
| **Uzun session context yönetimi** | Mobilde token maliyeti kullanıcıyı doğrudan etkiliyor (kendi API key'i) — agresif context budama/özetleme şart |
| **Termux Play Store'da yok** | F-Droid'den kurulum gerektiği net şekilde belirtilmeli, kullanıcı beklentisi baştan yönetilmeli |

---

## 7. Tech Stack Özeti

- **Client:** Expo/React Native, TypeScript, expo-secure-store, expo-notifications, react-native-webview (terminal için)
- **Bridge:** Node.js (ws kütüphanesi), Termux + Termux:API + Termux:Boot
- **Local persistence:** SQLite (session/workspace metadata)
- **AI:** Anthropic API (tool use), opsiyonel OpenRouter/OpenAI desteği
- **Lisans:** GPL-3.0
- **Dağıtım:** F-Droid, GitHub Releases

---

## 8. Sonraki Adım Önerisi

Faz 0 prototipiyle başlamak en mantıklısı: bridge server + WebSocket bağlantısı + "tek prompt ile dosya oluştur" akışını çalışır hale getirmek, sonra üzerine agent loop'u ve UI'ı katmanlamak. İstersen bridge server'ın kodunu birlikte yazmaya şimdi başlayabiliriz.