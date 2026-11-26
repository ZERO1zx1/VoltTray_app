# Desktop build ба суулгалт

## Шаардлагатай орчин

- Node.js `20.19+` эсвэл `22.12+` болон npm. Эдгээр нь төслийн Vite хувилбарын шаардлага.
- Rust stable toolchain (`rustup`, `cargo`).
- Linux build-д WebKitGTK, GTK/AppIndicator, librsvg болон `patchelf` сангууд.
- Windows build-д Windows хөгжүүлэлтийн орчин болон Tauri-ийн Windows prerequisite-ууд.

## Хөгжүүлэлтийн desktop апп

```bash
npm ci
npm run tauri:dev
```

Vite хөгжүүлэлтийн сервер `127.0.0.1:3000` дээр ажиллана. Tauri аппын Linux хувилбар hardware мэдээллийг sysfs/UPower-оос, Windows хувилбар Windows-ийн native API-аас уншина.

## Release build

### Arch Linux дээр хэрэглэгчийн desktop апп суулгах

```bash
npm run tauri:build -- --no-bundle
bash scripts/install-desktop.sh
```

Release executable болон frontend нь нэг native апп болно; ажиллуулахад Node/npm сервер хэрэггүй. Скрипт `$XDG_DATA_HOME/volttray/volttray` (үндсэндээ `~/.local/share/volttray/volttray`) руу суулгаж, Applications цэсэнд **VoltTray** icon нэмнэ. `sudo` хэрэггүй. Идэвхтэй autostart бүртгэл байвал шинэ тогтвортой зам руу шилжүүлнэ. Төслийн build хавтсыг цэвэрлэсэн ч суулгасан апп үлдэнэ.

Шинэчлэхдээ дээрх хоёр командыг давтаж, хуучин аппын tray → **Quit**, дараа нь Applications → **VoltTray** нээнэ. M220 батарейн hidraw эрхийг [тусдаа заавраар](m220.md) нэг удаа тохируулна.

### Түгээх багц

Linux:

```bash
npm run tauri:build -- --bundles deb,appimage
```

Windows:

```powershell
npm run tauri:build -- --bundles nsis,msi
```

Гаралтын файлууд:

- Linux: `src-tauri/target/release/bundle/appimage/` болон `src-tauri/target/release/bundle/deb/`
- Windows: `src-tauri/target/release/bundle/nsis/` болон `src-tauri/target/release/bundle/msi/`

Linux AppImage багцлах үед `linuxdeploy` AppImage Type 2 runtime-г GitHub-аас татдаг. Сүлжээгээр татах боломжгүй орчинд AppImage алхам бүтэлгүйтэж болох ч `.deb`-ийг тусад нь үүсгэж болно:

```bash
npm run tauri:build -- --bundles deb
```

AppImage runtime-ийн орчны хувьсагчийн тухай [AppImage-ийн албан ёсны баримт](https://docs.appimage.org/packaging-guide/environment-variables.html)-аас үзнэ үү.

Linux AppImage-г шууд ажиллуулах жишээ:

```bash
chmod +x src-tauri/target/release/bundle/appimage/VoltTray_1.0.0_amd64.AppImage
./src-tauri/target/release/bundle/appimage/VoltTray_1.0.0_amd64.AppImage
```

## CLI суулгагч ба Linux тохиргоо

Хурдан CLI суулгагчаар системийн орчин шалгах (`doctor`), суулгах (`install`), эсвэл цэвэрлэх (`uninstall`) боломжтой:

```bash
node scripts/cli.mjs doctor --lang mn
node scripts/cli.mjs install --dry-run --lang mn
npm run install:cli -- install --from-source --autostart
```

Valkyrie VK M3 Lite (M220) 2.4GHz хулганы батарейг Linux дээр унших бол зөвхөн `interface-02`-оор хязгаарлагдсан udev дүрмийг нэмэлтээр суулгана:

```bash
npm run install:cli -- install --from-source --m220-udev
# эсвэл зөвхөн udev дүрэм:
bash scripts/install-m220-access.sh
```

Апп анхны ажиллах үед login autostart-ыг идэвхжүүлдэг. Үүнийг аппын тохиргооноос унтрааж болно. Цонхыг хаахад апп tray-д үлдэж, tray-ийн **Quit** командаар бүрэн хаагдана.

## Arch Linux / Wayland дээр шалгасан startup мэдэгдлүүд

`gtk_widget_get_scale_factor: assertion 'GTK_IS_WIDGET (widget)' failed` гарсан ч widget хэвийн ажиллаж байж болно. 2026-11-15-ны локал debugger шалгалтаар энэ орчны дуудлагын зам нь `libappindicator3.so.1 → gtk_status_icon_set_from_file → gtk_widget_get_scale_factor` байсан. Хэрэглэгч цонх, товчлуурууд ажиллаж байгааг баталсан. Энэ тохиолдолд startup failure гэж үзэхгүй; GTK log-ийг глобалаар хаах шаардлагагүй. Цонх харагдахгүй эсвэл процесс хаагдвал тусдаа шинж тэмдэг тул дахин оношилно.

npm 12 дээр `esbuild`-ийн install script блоклогдсон тухай анхааруулга гарч болно. Төсөлд install script-ийн тусгай allowlist тохируулаагүй. Анхааруулга дангаараа build бүтэлгүйтсэнийг илэрхийлэхгүй; `npm test` болон `npm run build`-ийн үр дүнг шалгана. CI нь Node.js 22-той хамт ирэх npm хувилбарыг ашигладаг.

Шинэ хувилбар single-instance хамгаалалттай: дахин нээхэд ажиллаж буй аппын popup цонхыг харуулна. Хуучин хувилбараас шинэчилж байгаа эсвэл development хувилбарыг турших бол эхлээд ажиллаж буй аппыг tray цэсний **Quit**-ээр хаана.

## Шалгах командууд

```bash
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline
```
