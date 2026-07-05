# VibeShell — Proot Geçişi ve Arka Plan Kalıcılığı Planı

**Konsept:** Android üzerinde, **embedded proot Linux** ile çalışan, kullanıcının kendi API key'i ile çalışan açık kaynak bir agentic coding client. Claude Code / OpenCode'un mobildeki karşılığı.

---

## 1. Ürün Vizyonu

- **Platform:** Android only (artık Termux bağımlılığı yok - embedded proot ile tam bağımsız)
- **Lisans:** Açık kaynak (GPL-3.0)
- **Dağıtım:** F-Droid + GitHub Releases (Play Store hedeflenmiyor)
- **Hedef kullanıcı:** Telefonundan hızlı prompt atıp kod ürettirmek/düzenletmek isteyen developer/hobbyist
- **Farklılaştırıcı:** Gerçek shell + gerçek dosya sistemi + gerçek git — sadece "chat with code" değil, gerçek agent loop + **tek APK kurulumu, harici bağımlılık yok**

---

## 2. Yeni Mimari: Embedded Proot

```
┌───────────────────────────────────────────────┐
│              VibeShell App (tek APK)            │
│                                                   │
│  ┌─────────────────────────────────────────┐   │
│  │  Foreground Service (Kotlin)              │   │
│  │  - START_STICKY                            │   │
│  │  - Kalıcı bildirim                         │   │
│  │  - proot process'ini spawn eder            │   │
│  │  - Battery optimization whitelist isteği   │   │
│  └──────────────┬──────────────────────────┘   │
│                 │ ProcessBuilder.start()          │
│                 ▼                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  proot -r rootfs/ -b /dev -b /proc ...    │   │
│  │  └─ node server.js (bridge, mevcut kod)   │   │
│  └──────────────┬──────────────────────────┘   │
│                 │ WebSocket (127.0.0.1:8765)     │
│                 ▼                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  RN/Expo UI (chat, diff viewer, vs.)      │   │
│  └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

**Kritik prensip:** Bridge server kodunun kendisi (server.js) aynen korunuyor — sadece nerede çalıştığı değişiyor (Termux home dizini yerine proot rootfs'i içinde). Agent loop tamamen RN/JS tarafında kalıyor.

**Avantajlar:**
- ✅ Tek APK kurulumu, Termux bağımlılığı yok
- ✅ Foreground service ile arka planda kalıcılık
- ✅ Battery optimization kontrolü
- ✅ Kullanıcı deneyimi çok daha basit

---

## 3. Bileşenler Detayı

### 3.1 RN/Expo App

| Modül | Açıklama |
|---|---|
| **Onboarding** | İlk açılışta rootfs indirme + proot başlatma, battery optimization izni iste |
| **Ayarlar** | API key girişi (Expo SecureStore ile şifreli sakla), provider seçimi (Anthropic/OpenAI/OpenRouter), model seçimi, sistem prompt özelleştirme |
| **Workspace yönetimi** | Proje listesi, her biri proot rootfs içinde bir dizine bağlı (`/root/projects/xxx`), git clone/pull/init desteği |
| **Chat ekranı** | Prompt gir, agent'ın tool call'larını canlı göster (örn. "📁 dosya okunuyor: App.tsx", "⚙️ komut çalıştırılıyor: npm install") |
| **Diff viewer** | Her write_file/patch işleminden önce diff göster, onayla/reddet/düzenle seçeneği |
| **Terminal görünümü** | Ham stdout/stderr stream'i isteyen kullanıcı için (xterm.js benzeri, react-native-webview içinde) |
| **Dosya gezgini** | Read-only ağaç görünümü + syntax highlight'lı içerik görüntüleme |
| **Bildirimler** | Uzun süren task bitince push notification (expo-notifications) — mobilin CLI'a karşı en büyük avantajı |

### 3.2 Foreground Service (Kotlin Native Module)

- `BridgeForegroundService` - START_STICKY ile kalıcı servis
- Kalıcı bildirim gösterir ("VibeShell çalışıyor")
- ProcessBuilder ile proot + node server.js spawn eder
- Process handle'ı tutar, crash durumunda restart eder
- Battery optimization whitelist ister
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission

### 3.3 Proot Linux Ortamı

- Alpine Linux minimal rootfs (küçük boyut, ~50MB)
- Node.js önceden kurulu (build-time'da)
- proot binary ABI başına: arm64-v8a, armeabi-v7a
- İlk açılışta GitHub Release'ten indirilir ve filesDir'e extract edilir
- Bind mount'lar: `/dev`, `/proc`, `/sys`

### 3.4 Bridge Server (Node.js) - MEVCUTİ AYNEN KULLANILIYOR

- WebSocket server, tek dosyalık basit bir servis
- Desteklenen komutlar: `exec`, `read_file`, `write_file`, `list_dir`, `delete_file`, `git_*`
- Token auth (mevcut mekanizma aynen korunuyor)
- 127.0.0.1:8765 bind

### 3.5 Agent Loop - AYNEN KORUNUYOR

- Claude API'ye system prompt + tool tanımları ile istek
- Tool şeması:
  - `run_command(command, cwd)`
  - `read_file(path)`
  - `write_file(path, content)`
  - `list_dir(path)`
  - `apply_patch(path, diff)` — diff-based edit, tam dosya yazmaktan daha güvenli/tokensiz
  - `git_diff()`, `git_commit(message)`
- Multi-turn loop: tool_result'ları context'e ekleyip tekrar Claude'a gönder, `stop_reason: end_turn` gelene kadar devam
- Context window yönetimi: uzun session'larda eski tool result'ları özetle/budala

---

## 4. Yeni Kurulum Akışı (Kullanıcı Deneyimi) - ÇOK DAHA BASİT

1. Kullanıcı APK'yı kurar (F-Droid veya GitHub Releases)
2. App açılır → İlk açılış kurulum ekranı:
   - "Linux ortamı indiriliyor..." (~50MB Alpine rootfs)
   - "Ortam hazırlanıyor..." (extract + proot test)
   - "Battery optimization izni" → sistem ayarlarına yönlendirme
3. Kurulum tamamlandı → "✅ VibeShell hazır"
4. Kullanıcı API key girer, model seçer, ilk workspace'ini oluşturur
5. Chat ekranından prompt yazmaya başlar

**Toplam 5 dakika, harici uygulama kurulumu YOK!**

---

## 5. Proot Geçişi Fazları

### Faz 1 — Rootfs ve proot binary hazırlığı ✅ TAMAMLANDI
- [x] Alpine Linux minimal rootfs builder scripti (`native-build/build-rootfs.sh`)
- [x] proot binary + bağımlılıklarını Termux packages repo'sundan indirme (`native-build/get-proot-binary.sh`)
  - proot binary (dynamic linked) + libtalloc.so.2 + libandroid-shmem.so
  - Loader'lar (static linked) — toplam ~350KB per arch
  - Desteklenen mimariler: arm64-v8a, armeabi-v7a
- [x] GitHub Actions workflow (`native-build/.github/workflows/build-native.yml`)
- [x] Native Kotlin modülü (ProotModule.kt, BridgeForegroundService.kt, ProotPackage.kt)
- [x] TypeScript wrapper (src/native/ProotModule.ts)
- [x] Expo config plugin (plugins/withProotModule.js)

### Faz 2 — Native module: proot lifecycle yönetimi ✅ TAMAMLANDI
- [x] Expo config plugin ile Kotlin native module oluşturuldu
- [x] ProcessBuilder ile proot spawn fonksiyonu (BridgeForegroundService.kt)
- [x] stdout/stderr'i Android log'a yönlendirme
- [x] Process handle'ı service içinde, crash durumunda restart

### Faz 3 — Foreground Service (asıl kalıcılık çözümü) ✅ TAMAMLANDI
- [x] BridgeForegroundService sınıfı, START_STICKY
- [x] Kalıcı bildirim ("VibeShell çalışıyor")
- [x] foregroundServiceType="specialUse" (Android 14+ için)
- [x] Servis lifecycle yönetimi

### Faz 3.5 — RN UI Bileşenleri ✅ TAMAMLANDI
- [x] Chat ekranı: ChatMessage.tsx, ChatInput.tsx, MarkdownRenderer.tsx
- [x] Tool call gösterimi: ToolCallCard.tsx
- [x] Diff viewer: DiffViewer.tsx
- [x] Connection durumu: ConnectionStatus.tsx
- [x] Workspace yönetimi: WorkspaceCard.tsx
- [x] Agent loop: AgentLoop.ts (tool use + multi-turn)
- [x] Bridge client: WebSocketClient.ts + commands.ts
- [x] State management: useChatStore, useBridgeStore, useSettings, useWorkspaces
- [x] Tema sistemi: colors, typography, spacing

### Faz 4 — Battery optimization ve OEM kısıtlamaları 🔲 BAŞLANMADI
- [ ] REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission ekle
- [ ] İlk açılışta kullanıcıdan whitelist iste
- [ ] Onboarding'e dontkillmyapp.com tarzı OEM-specific talimat ekranı ekle
- [ ] Build.MANUFACTURER ile OEM tespiti, deep link ile ayar ekranına yönlendirme

### Faz 5 — Güvenlik ve doğrulama � BAŞLANMADI
- [ ] Mevcut token-auth mekanizmasını proot içinde test et
- [ ] 127.0.0.1 bind'ini doğrula (proot network namespace testi)
- [ ] SELinux/noexec mount flag testleri
- [ ] filesDir'in exec permission'ı olduğunu doğrula

### Faz 6 — Test matrisi 🔲 BAŞLANMADI
- [ ] En az 3 farklı OEM'de test: Pixel, Samsung, Xiaomi
- [ ] Farklı Android sürümleri: 10, 13, 14+
- [ ] Uzun süreli arka plan testi (30dk-1saat)
- [ ] Recent apps swipe testi
- [ ] Düşük RAM cihazda OOM davranışı testi

### Faz 7 — Migration (opsiyonel, uzun vadeli) 🔲 BAŞLANMADI
- [ ] Mevcut Termux kullanıcıları için "legacy mode" seçeneği
- [ ] Uzun vadede Termux modu deprecate edilebilir

---

## 6. Riskler ve Azaltma Stratejileri

| Risk | Etki | Azaltma |
|---|---|---|
| **noexec mount üzerinde proot çalışmıyor** | Yüksek | filesDir altında test et, gerekirse nativeLibraryDir trick'i (native lib olarak paketleyip oradan çalıştırma) |
| **Android 14+ foreground service type reddi** | Orta | specialUse type + F-Droid review'ı daha toleranslı (Play Store'a gitmiyoruz) |
| **APK/asset boyutu çok büyür** | Orta | Rootfs'i ilk açılışta indir, APK'ya gömme (~50MB indirme) |
| **proot performans overhead'i** | Düşük-Orta | Syscall interception yavaşlığı, ağır build işlemlerinde (webpack, gradle) sorun olabilir - kullanıcıya bildir |
| **OEM'in agresif kill'i foreground service'e rağmen devam eder** | Orta | dontkillmyapp.com talimatları + kullanıcıya net uyarı, %100 çözüm yok |
| **Güvenlik** | Düşük | Bridge server 127.0.0.1 bind + token auth (mevcut mekanizma korunuyor) |
| **Uzun session context yönetimi** | Orta | Mobilde token maliyeti kullanıcıyı doğrudan etkiliyor — agresif context budama şart |

---

## 7. Tech Stack Özeti

- **Client:** Expo/React Native, TypeScript, expo-secure-store, expo-notifications, react-native-webview (terminal için)
- **Native:** Kotlin native module (Expo config plugin), Foreground Service
- **Linux ortamı:** Alpine Linux rootfs, proot (dynamic linked, Termux packages'tan indirilen: proot + libtalloc + libandroid-shmem), Node.js önceden kurulu
- **Bridge:** Node.js (ws kütüphanesi) - **MEVCUT KOD AYNEN KULLANILIYOR**
- **Local persistence:** SQLite (session/workspace metadata)
- **AI:** Anthropic API (tool use), opsiyonel OpenRouter/OpenAI desteği
- **Lisans:** GPL-3.0
- **Dağıtım:** F-Droid, GitHub Releases

---

## 8. Öncelik Sırası ve Sonraki Adımlar

### Önerilen Yaklaşım

Faz 1-3 ve UI bileşenleri tamamlandı. **Sırada kritik eksik parçalar var:**

### İlk Somut Adım (ŞİMDİ) — App'i Çalışabilir Hale Getir

1. **App.tsx'i yeniden yaz** — mevcut src/ component'lerini bağla
   - Onboarding ekranı (rootfs indirme + proot başlatma)
   - Ana chat ekranı
   - Ayarlar ekranı

2. **Bridge server'ı proot içinde çalıştır**
   - Rootfs + Node.js + bridge server setup
   - İlk açılışta rootfs indir + extract
   - Foreground service → proot spawn → Node.js bridge

3. **`npx expo start --tunnel` ile test et**
   - Tunnel modu Android cihazdan erişim sağlar
   - Bridge bağlantısını doğrula
   - Agent loop'u canlı test et

4. **Battery optimization + OEM**
   - dontkillmyapp.com talimatları
   - OEM-specific ayar yönlendirmeleri

### Sonraki Adımlar
- Faz 5 — Güvenlik ve doğrulama
- Faz 6 — Test matrisi (Pixel, Samsung, Xiaomi)
- Faz 7 — Production release (F-Droid, GitHub Releases)
