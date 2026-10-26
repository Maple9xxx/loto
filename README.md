# 🎴 Lô Tô Dò Số

Ứng dụng dò lô tô giấy ngay trên điện thoại. Thay vì đặt chip lên từng tờ vé, bạn chỉ cần **chạm số vừa nghe**: app tự đánh dấu cho cả 8 màu vé, báo màu nào đang **đợi**, màu nào **kinh** — để cả bàn theo dõi được nhau.

- Cài về máy như một ứng dụng thật (PWA), chạy offline.
- Giao diện 3D bằng **three.js**: bóng lô tô thật rơi xuống khi gọi số, pháo hoa khi có người kinh.
- Mọi màn hình **vừa khít một màn hình điện thoại**, không phải vuốt lên xuống.

## Cách dùng nhanh

| Tab | Làm gì |
|---|---|
| **Gọi số** | Bảng 1–90. Chạm số vừa nghe để gọi. Chạm lại số đã gọi (trong 2 giây) để huỷ. Chấm màu nhỏ dưới số = màu đang đợi đúng số đó. Có nút **Hoàn tác**. Gõ phím số cũng được (bàn phím rời / máy tính). |
| **Theo dõi** | Thẻ 8 màu: mỗi màu còn bao nhiêu hàng đang đợi, kinh, biểu đồ tiến độ. Dải "số đang được đợi" ở trên cùng — chạm một số để biết màu nào, tờ nào, hàng nào sẽ kinh. |
| **Vé** | Tra từng tờ / bảng / hàng của từng màu, hàng nào đã trúng số nào được tô sáng. |
| **Thêm** | Chọn **màu của tôi** (hiện ★ ở khắp nơi), xem lịch sử số đã gọi, **Ván mới** (bấm nhầm thì khôi phục lại được ngay), và cài đặt (âm thanh, rung, giữ màn hình sáng, đọc số thành tiếng, hiệu ứng 3D, cài app). |

Trạng thái ván chơi tự lưu trong máy — tải lại trang không mất.

## Cài về điện thoại

- **Android (Chrome)**: bấm nút **Cài app** ở góc trên, hoặc menu ⋮ → *Cài đặt ứng dụng / Thêm vào màn hình chính*.
- **iPhone / iPad (Safari)**: bấm nút Chia sẻ → *Thêm vào MH chính*. (iOS không cho web tự bật hộp thoại cài, app sẽ hiện hướng dẫn 3 bước.)
- **Máy tính (Chrome / Edge)**: biểu tượng cài đặt ở thanh địa chỉ, hoặc nút **Cài app** trong app.

Muốn cài được thì app phải chạy qua **HTTPS** (GitHub Pages có sẵn) hoặc `localhost`. Mở thẳng file `index.html` bằng `file://` vẫn dùng được nhưng không cài được và không có chế độ offline.

## Đưa lên GitHub Pages

Thư mục này **đã build sẵn** (`assets/`, `sw.js`, `icons/`...). Chỉ cần:

1. Đẩy toàn bộ nội dung thư mục lên repo (không cần `node_modules`).
2. Settings → Pages → chọn branch `main`, thư mục `/ (root)`.
3. Mở `https://<user>.github.io/<repo>/` trên điện thoại rồi cài.

Đường dẫn trong app đều là đường dẫn tương đối nên chạy được ở bất kỳ thư mục con nào.

## Phát triển / build lại

```bash
npm install
npm run build        # bundle three.js + CSS → assets/, sinh sw.js
npm run dev          # build lại mỗi khi sửa file trong src/
npm run serve        # server tĩnh http://localhost:5173
node scripts/test-engine.mjs   # kiểm tra logic 144 hàng
```

Mỗi lần `build`, `sw.js` được gắn mã băm của file mới nên người dùng sẽ tự nhận bản cập nhật.

Thêm `?debug` vào URL để mở `window.__loto` (store + stage 3D) phục vụ kiểm thử.

Làm lại icon: thay `scripts/icon-source.png` rồi chạy `pip install pillow numpy scipy && python3 scripts/make-icons.py` (tự cắt viền trắng, sinh toàn bộ icon trong `icons/`).

## Cấu trúc

```
index.html              khung trang (canvas 3D + 4 tab)
manifest.webmanifest    thông tin PWA
sw.js                   service worker (sinh từ src/sw.js khi build)
assets/                 app.js (đã nén, gồm three.js), app.css, fonts/
icons/                  icon app, icon maskable, apple-touch-icon, favicon
src/
  data.js               dữ liệu 8 màu · 16 tờ · 48 bảng · 144 hàng
  engine.js             tính hàng đợi / kinh cho từng số gọi
  store.js              lưu ván chơi + cài đặt, khôi phục ván, nâng cấp dữ liệu từ bản cũ
  three/                bóng 3D, texture, pháo hoa (stage3d.js, fx.js, textures.js)
  ui/                   các màn hình (call / watch / tickets / more), sheet, toast
  pwa.js, audio.js ...  cài app, wake lock, âm thanh, đọc số
scripts/                build, server, trích dữ liệu, test
```

## Hiệu năng 3D

App tự hạ chất lượng (giảm độ phân giải, rồi chuyển sang chế độ **Tiết kiệm**) nếu máy yếu hoặc bật *giảm chuyển động*. Có thể chỉnh tay ở Thêm → Cài đặt → *Hiệu ứng 3D*. Nếu thiết bị không có WebGL, bóng 3D thay bằng bóng vẽ CSS, mọi chức năng vẫn chạy bình thường.

## Ghi chú về dữ liệu

Dữ liệu vé được trích nguyên từ bản gốc (tên tờ giữ nguyên). Chỉ sửa **một nhãn nhập nhầm**: bảng xanh dương ghi "Bảng 38" được đánh lại thành **Bảng 10** (để số bảng 1–48 không bị trùng). Nội dung các số không thay đổi.
