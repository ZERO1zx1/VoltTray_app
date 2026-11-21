# Linux дээр AirPods-ийн цэнэг харах

VoltTray нь ажиллаж байгаа **kAirPods** service-ийн мэдээллийг уншиж зүүн, баруун, кейс болон AirPods Max-ийн цэнэгийг харуулна. kAirPods суулгаагүй бол VoltTray-ийн sysfs, UPower, OpenRazer, headsetcontrol уншилтууд хэвийн үргэлжилнэ.

## Шаардлага

- Linux, хэрэглэгчийн session D-Bus, JSON output дэмждэг `busctl`.
- Тусад нь суулгаж ажиллуулсан [kAirPods](https://github.com/can1357/kAirPods).
- kAirPods-д холбогдсон, батарейн мэдээллээ өгч байгаа AirPods.

VoltTray kAirPods-ийг суулгах, асаах, Bluetooth pairing хийх, ANC эсвэл playback тохиргоог өөрчлөхгүй. Зөвхөн `GetDevices` method дуудна. kAirPods-ийн өөрийн Plasma widget нь VoltTray-д өгөгдөл уншуулахын тулд заавал нээлттэй байх шаардлагагүй; session service-ийн бодит ажиллах байдлыг доорх командаар шалгана.

## Ажиллуулах

```bash
cd /home/light/Projects/battery
npm run tauri:dev
```

AirPods харагдахгүй бол өөрийн desktop terminal-аас:

```bash
busctl --user --json=short --timeout=1s --auto-start=no \
  call org.kairpods /org/kairpods/manager org.kairpods.manager GetDevices
```

Service олдохгүй бол kAirPods-ийн суулгалт/ажиллагааг шалгана. `Operation not permitted` бол тухайн terminal/process хэрэглэгчийн session bus-д хандаж чадахгүй байна. VoltTray энэ алдааг 0% батарей гэж хувиргахгүй.

## Widget-ийн утга

- Үндсэн хувь нь мэдэгдэж байгаа зүүн/баруун/Max батарейн **хамгийн бага** утга. Кейс байвал тусдаа харагдана. Зөвхөн кейсний мэдээлэл ирсэн үед үндсэн хувь кейсийг илэрхийлнэ.
- Зүүн/баруун/кейсийн нэг утга ирэхгүй бол тухайн хэсгийг 0% гэж зохиохгүй, харуулахгүй.
- Үндсэн charging төлөвийг тооцоход ашигласан бүх хэсэг charging бол цэнэглэж байна гэж харуулна. Тус бүрийн ⚡ тэмдэг тусдаа төлөвийг заана.
- Bluetooth MAC-аар UPower ба kAirPods-ийн уншилтыг нэгтгэнэ. MAC байхгүй эх сурвалжийн мөр тусдаа үлдэж болно.
- Native cache ердийн үед 30 секунд тутам бүрэн шинэчлэгддэг; Refresh товчоор шууд уншуулж болно. UI-ийн 1.5 секундийн poll нь Bluetooth хэмжилтийн давтамж биш.
- Доод Bell товч сануулгыг асааж/унтраана. Төхөөрөмжийн дэлгэрэнгүйд 15%/20% босгыг сольж болно. DND/fullscreen suppression тохиргоог мөн мөрдөнө.

## Бодит төхөөрөмжийн хүлээн авах шалгалт

1. Service-ийн JSON дахь `connected`, `battery.left/right/case/headphone` утгыг widget-тэй тулгах.
2. Кейсийг залгаж/салгаж, зүүн/баруун чихэвчийг тусад нь гаргахад мөр бүрийн төлөвийг шалгах.
3. AirPods салгахад kAirPods-ийн хуучин component мэдээлэл дараагийн full scan-аар арилахыг шалгах.
4. UPower export идэвхтэй үед ижил MAC нэг карт болж буйг шалгах.
5. Bell унтарсан үед сануулга ирэхгүй, 20% босго сонгосон үед түүнийг мөрдөж буйг шалгах.

Хязгаар: одоогийн сануулгыг UI snapshot боловсруулах үед гаргадаг. Widget далд үед тасралтгүй native background notification баталгаажаагүй. Windows-д kAirPods adapter ажиллахгүй; Windows нь одоогийн PnP provider-оо ашиглана. Upstream snapshot өөрийн хэмжилтийн цагийг өгөхгүй тул VoltTray хүлээн авсан цагийг батарей физик хэмжигдсэн цаг гэж батлахгүй.
