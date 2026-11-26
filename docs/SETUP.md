# Setup do ambiente (macOS)

Inventário feito em 2026-10-12 num MacBook Apple Silicon (macOS 26.6.2, 16 GB).

| Ferramenta | Versão | Observação |
|---|---|---|
| Godot | 4.7.2 estável | `/Applications/Godot.app` (Homebrew cask `godot`) |
| Templates de exportação | 4.7.2 | `~/Library/Application Support/Godot/export_templates/4.7.2.stable` |
| JDK | OpenJDK 17.0.20 | Homebrew `openjdk@17` (o cask Zulu exigia senha de admin) |
| Android SDK | platform-tools, build-tools 35.0.1, android-35, cmdline-tools, CMake 3.10.2, NDK r28b | `~/Library/Android/sdk` (versões pedidas pela doc do Godot 4.7) |
| Android Studio | atual | emulador ainda sem imagem de sistema |
| Xcode | 27.0 | SDK iOS 27; conta Apple **ainda não conectada** |
| Node.js / npm | 22.14 / 10.9 | Node 24 LTS recomendado futuramente |
| Docker / Compose | 29.8 / 5.5 | PostgreSQL roda no Docker |
| Git / GitHub CLI | 2.54 / 2.96 | `gh` logado como `brmagalhaess` |

Variáveis no `~/.zshrc`: `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `PATH` (adb, sdkmanager)
e alias `godot`. O Godot detectou SDK e JDK sozinho (Editor Settings → Export → Android) e criou a
keystore de debug.

## Do zero

```bash
brew install --cask godot android-studio android-commandlinetools
brew install openjdk@17
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
sdkmanager --sdk_root="$HOME/Library/Android/sdk" --licenses
sdkmanager --sdk_root="$HOME/Library/Android/sdk" "platform-tools" "build-tools;35.0.1" \
  "platforms;android-35" "cmdline-tools;latest" "cmake;3.10.2.4988404" "ndk;28.1.13356709"
# Templates: Godot → Editor → Manage Export Templates → Download (ou o .tpz oficial do GitHub)
```

Depois siga os comandos do `AGENTS.md`.

## Pendências manuais
- Xcode → Settings → Accounts → entrar com a conta Apple Developer.
- CocoaPods (`brew install cocoapods`) somente na etapa do AdMob.
