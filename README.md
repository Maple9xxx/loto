# 🎴 Lô Tô Dò Số

Ứng dụng hỗ trợ dò số lô tô giấy truyền thống (8 màu · 16 tờ · 48 bảng · 144 hàng), chạy hoàn toàn trên trình duyệt — không cần cài đặt, không cần máy chủ.

Chơi ngay: https://maple9xxx.github.io/loto

## Tính năng

**Quản lý số gọi**
- Nhập số thủ công hoặc chọn nhanh qua bảng 1–90
- Huỷ số cuối hoặc huỷ bất kỳ số nào bằng cách tap 2 lần trong bảng chọn nhanh
- Cảnh báo tức thì nếu nhập số không hợp lệ hoặc đã gọi

**Hiển thị trực quan**
- Vòng LED hiển thị số vừa gọi, đổi màu theo trạng thái: thường / đang chờ / kinh
- 8 màu hiển thị 2 tờ song song, dễ quan sát cùng lúc
- Ô số nhấp nháy khi hàng còn thiếu đúng 1 số (trạng thái *Đợi*)
- Hiệu ứng neon pulsing khi hàng vào trạng thái *Đợi* hoặc *Kinh*
- Badge đếm số hàng đang chờ theo từng màu

**Trải nghiệm sử dụng**
- Âm thanh phản hồi cho từng sự kiện (gọi số, đợi, kinh, huỷ, lỗi) với nút bật/tắt
- Tự động lưu trạng thái ván chơi vào LocalStorage — tải lại trang không mất dữ liệu
- Thiết kế tối ưu cho điện thoại, xử lý tap delay 300ms

## Bộ bài

Ứng dụng sử dụng bộ lô tô chuẩn gồm 8 màu, mỗi màu 2 tờ, mỗi tờ 3 bảng, mỗi bảng 3 hàng × 5 số. Số chạy từ 1 đến 90.

| Màu | Tờ 1 | Tờ 2 |
|---|---|---|
| Xanh Dương | Tờ 1 (Bảng 7–9) | Tờ 2 (Bảng 11–12, 38) |
| Xanh Lá Nhạt | Tờ 13 (Bảng 13–15) | Tờ 14 (Bảng 16–18) |
| Đỏ | Tờ Đỏ 1 (Bảng 1–3) | Tờ Đỏ 2 (Bảng 4–6) |
| Xanh Lá Đậm | Tờ 34 (Bảng 34–36) | Tờ 31 (Bảng 31–33) |
| Cam | Tờ 22 (Bảng 22–24) | Tờ 19 (Bảng 19–21) |
| Vàng | Tờ 43 (Bảng 43–45) | Tờ 46 (Bảng 46–48) |
| Tím | Tờ 37 (Bảng 37–39) | Tờ 40 (Bảng 40–42) |
| Hồng | Tờ 25 (Bảng 25–27) | Tờ 28 (Bảng 28–30) |

---

## Công nghệ

Ứng dụng được xây dựng hoàn toàn bằng HTML5, CSS3 và JavaScript thuần — không có framework, không có dependency ngoài Google Fonts. Âm thanh được tổng hợp trực tiếp qua Web Audio API, không cần file âm thanh bên ngoài.

---

## Giấy phép

MIT License — tự do sử dụng và chỉnh sửa cho mục đích cá nhân hoặc cộng đồng.
