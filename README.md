# AirDraw ✋

Kamera oldida qo‘l ishoralari bilan chizish. TypeScript + Vite + MediaPipe Hand Landmarker, Node.js build skriptlari.

| Ishora | Amal |
|---|---|
| 👆 ko‘rsatkich barmoq | chizish |
| ✊ musht | eng yaqin chizmani surish |
| 🤏 chimchilash | kattalashtirish/kichraytirish (qo‘lni kameraga yaqinlashtiring/uzoqlashtiring yoki ikki qo‘l bilan) |
| ✋ ochiq kaft | kaft turgan joydan o‘chirish |

## Ishga tushirish
```bash
npm install
npm run dev        # http://localhost:5173 (kamera uchun localhost yoki HTTPS kerak)
npm run build      # dist/ papkasi
```
Termux: `pkg install nodejs git`, so‘ng yuqoridagilar.

## GitHub → Netlify
1. `git init && git add . && git commit -m "AirDraw" && git branch -M main`
2. GitHub'da repo oching, `git remote add origin <url> && git push -u origin main`
3. Netlify → Add new site → Import from Git → repo'ni tanlang. Sozlamalar `netlify.toml` da tayyor (build: `npm run build`, publish: `dist`, Node 20).

`scripts/prepare.mjs` build vaqtida MediaPipe WASM va modelni `public/` ga qo‘yadi (model yuklanmasa, ish vaqtida CDN'dan olinadi).
