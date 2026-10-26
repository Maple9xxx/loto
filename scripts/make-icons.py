#!/usr/bin/env python3
"""Sinh toàn bộ icon từ scripts/icon-source.png (cần: pip install pillow numpy scipy).
   Chạy:  python3 scripts/make-icons.py
   - Tự cắt viền trắng ở 4 góc (thành trong suốt) rồi cắt sát khung bo góc.
   - icon-192 / icon-512 / favicon: giữ góc bo, nền trong suốt.
   - apple-touch-icon / icon-maskable: tràn viền (không có góc trong suốt) vì iOS/Android tự bo góc.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / "icon-source.png"
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)

im = Image.open(SRC).convert("RGB")
a = np.array(im).astype(int)

# 1) Viền trắng = vùng gần trắng nối với mép ảnh
near_white = a.min(axis=2) >= 225
lab, _ = ndi.label(near_white)
border_ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border_ids))
alpha = ndi.binary_fill_holes(~bg).astype(np.uint8) * 255
# co 2px cho sạch viền trắng còn sót, rồi làm mềm mép
alpha_img = Image.fromarray(alpha).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))

rgba = im.convert("RGBA")
rgba.putalpha(alpha_img)

# 2) Cắt sát khung, đệm cho vuông
bbox = alpha_img.point(lambda v: 255 if v > 128 else 0).getbbox()
rgba = rgba.crop(bbox)
side = max(rgba.size)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(rgba, ((side - rgba.width) // 2, (side - rgba.height) // 2))

# 3) Bản tràn viền: tô góc trong suốt bằng màu của điểm gần nhất (chỉ nằm ngoài vùng bị bo/che)
arr = np.array(sq)
core = arr[..., 3] > 250
idx = ndi.distance_transform_edt(~core, return_distances=False, return_indices=True)
filled_arr = arr[idx[0], idx[1]].copy()
filled_arr[..., 3] = 255
filled = Image.fromarray(filled_arr, "RGBA").convert("RGB")

def save(img, name, px):
    img.resize((px, px), Image.LANCZOS).save(OUT / name, optimize=True)
    print("✓", name, px)

# any (góc bo, trong suốt)
save(sq, "icon-512.png", 512)
save(sq, "icon-192.png", 192)
save(sq, "favicon.png", 64)

# apple-touch-icon: tràn viền, cắt nhẹ 3% mỗi cạnh
m = int(side * 0.03)
save(filled.crop((m, m, side - m, side - m)), "apple-touch-icon.png", 180)

# maskable: hình chính thu 88% (nằm gọn trong mặt nạ tròn), mép hoà vào nền cùng tông để không lộ khung
S = 512
back = filled.resize((S, S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(24))
fgs = int(S * 0.88)
fg = filled.resize((fgs, fgs), Image.LANCZOS)
feather = Image.new("L", (fgs, fgs), 0)
inset = int(fgs * 0.035)
ImageDraw.Draw(feather).rectangle((inset, inset, fgs - inset, fgs - inset), fill=255)
feather = feather.filter(ImageFilter.GaussianBlur(inset * 0.6))
back.paste(fg, ((S - fgs) // 2, (S - fgs) // 2), feather)
back.save(OUT / "icon-maskable-512.png", optimize=True)
print("✓ icon-maskable-512.png 512")
