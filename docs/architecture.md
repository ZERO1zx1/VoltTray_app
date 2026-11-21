# Төслийн бүтэц ба архитектур

**VoltTray** нь Windows болон Linux-д зориулсан, зөвхөн унших горимтой (read-only), локал десктоп батарей хянагч юм. Нэг React интерфэйс нь хоёр орчинд ажилладаг: үндсэн **Tauri v2 (Rust)** десктоп апп болон хөгжүүлэлтэд ашиглах **Node/Express** локал сервер.

```text
VoltTray_app/
├── .github/workflows/
│   ├── ci.yml                     # Typecheck, Node тест, Rust cargo test, Vite build
│   └── release.yml                # Tag (v*) үүсэхэд Windows & Linux суулгагч угсрах
├── docs/
│   ├── README.md                  # Баримт бичгийн жагсаалт
│   ├── architecture.md            # Хавтасны бүтэц ба хамаарлын дүрэм
│   ├── desktop-build.md           # Build болон суулгах заавар
│   ├── airpods.md                 # kAirPods D-Bus заавар
│   └── m220.md                    # M220 2.4GHz HID протокол
├── landing/                       # 32 KB эх танилцуулга хуудас (EN/MN)
│   ├── index.html
│   └── styles.css
├── scripts/
│   ├── cli.mjs / cliCore.mjs      # Хоёр системд ажиллах CLI суулгагч (doctor/install/uninstall)
│   ├── cliCore.test.mjs           # CLI unit тестүүд
│   ├── install.sh / install.ps1   # Linux (curl) & Windows (PowerShell) нэг мөр суулгагч
│   ├── install-desktop.sh         # Linux хэрэглэгчийн (sudo-гүй) desktop entry суулгагч
│   ├── install-m220-access.sh     # M220 interface-02 udev дүрэм суулгагч
│   ├── install-linux.sh           # Linux бүрэн тохиргооны скрипт
│   ├── clean.mjs                  # dist/ цэвэрлэгч
│   └── test.mjs                   # src/ болон scripts/ доторх бүх тестийг ажиллуулна
├── src/
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Tauri дотор DesktopApp, хөтөч дээр Workbench/Landing нээнэ
│   ├── DesktopApp.tsx             # Native 400 × 480 Tauri десктоп runtime холбогч
│   ├── index.css                  # Tailwind v4 болон нэгдсэн загвар
│   ├── components/                # TrayWidget, DeviceRow, SettingsPanel, DesktopWorkbench, LandingPreview
│   ├── lib/                       # types, defaults, i18n, battery (+test), desktopBridge
│   └── server/                    # Хөгжүүлэлтийн локал fallback сервер (Express)
├── src-tauri/                     # Native Rust десктоп цөм (Tauri v2)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/default.json
│   ├── icons/                     # 32x32, 128x128, 128x128@2x, 512x512 icon.png, icon.ico
│   ├── linux/70-volttray-m220.rules
│   └── src/
│       ├── main.rs                # Tray icon, background alert daemon + Rust unit тестүүд
│       ├── autostart.rs           # Windows Registry & Linux XDG autostart
│       ├── notifications.rs       # Linux notify-send & Windows NotifyIcon мэдэгдэл
│       └── hardware/              # Win32/WMI/PnP + Linux sysfs/UPower/OpenRazer/M220/kAirPods
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## Хамаарлын дүрэм

1. `src/components/` нь зөвхөн `src/lib/`-ээс импортлоно; Tauri эсвэл Node сервертэй шууд харьцахгүй.
2. `src/lib/battery.ts`, `types.ts`, `i18n.ts`, `defaults.ts` нь React болон Node API-аас хамааралгүй цэвэр модулиуд.
3. `src/lib/desktopBridge.ts` нь UI болон native Rust / Express серверийн цорын ганц зааг.
4. `src/server/` нь зөвхөн локал хөгжүүлэлт/fallback орчинд ажиллах ба UI bundle дотор хэзээ ч импортлогдохгүй.
5. `src-tauri/src/hardware/mod.rs` дахь `PeripheralDeviceDto` болон `src/lib/types.ts` дахь `PeripheralDevice` үргэлж 1:1 ижил талбартай байна.
