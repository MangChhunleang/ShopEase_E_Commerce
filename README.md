# ShopEase Monorepo

A three-part commerce stack:

- **Backend** – Node.js/Express API on MySQL with JWT auth, Firebase phone auth bridge, Bakong KHQR payments, and media uploads.
- **Admin Web** – React + Vite dashboard for managing products, categories, banners, and orders.
- **Mobile App** – Flutter shopper app with Firebase Auth, KHQR payments, and shared catalog.

## 📸 Screenshots

### Admin Panel Dashboard
<img width="1917" height="300" alt="Screenshot 2026-01-14 233033 (1)" src="https://github.com/user-attachments/assets/44dce473-ad18-480a-a9b7-496d7fe0ee48" />


### Mobile App - Home & Categories
<p>
   <img src="https://github.com/user-attachments/assets/981906a7-6c6f-417a-bbb5-c611f6f03fb5" alt="Mobile Categories" width="32%" />
   <img src="https://github.com/user-attachments/assets/d01580fe-56ae-492b-a86a-5c750fb8f720" alt="Mobile Home" width="32%" />
</p>

### Mobile App - Bakong Payment Integration
<p>
   <img src="https://github.com/user-attachments/assets/e701fd51-b6fc-4184-aea0-b1fe7fdee319" alt="Bakong Payment" width="32%" />
</p>


## Repository Layout

- `backend/` – Express server, MySQL access layer, Bakong + Firebase integrations, upload handling.
- `frontend/` – React admin UI built with Vite and Tailwind.
- `mobile_shopease/` – Flutter consumer app for Android/iOS/web.

## Tech Stack

- Backend: Node 20+, Express, MySQL (`mysql2`), JWT, Firebase Admin, Bakong KHQR, Multer, Joi, Twilio/Vonage (SMS), Axios.
- Frontend: React 19, React Router 7, Tailwind 4, Axios, Vite.
- Mobile: Flutter 3.9, firebase_auth, firebase_core, provider, carousel_slider, shared_preferences, image_picker, permission_handler.

## Quick Start

### Backend API

1. `cd backend && npm install`
2. Create `.env` in `backend/` with at minimum:
   ```env
   DATABASE_URL=mysql://user:pass@localhost:3306/shopease
   JWT_SECRET=replace_me
   ALLOWED_ORIGINS=http://localhost:5173
   DEBUG=false
   # Bakong (KHQR)
   BAKONG_ACCESS_TOKEN=your_token
   BAKONG_MERCHANT_ID=your_merchant@bank
   BAKONG_MERCHANT_NAME=ShopEase
   BAKONG_MERCHANT_CITY=Phnom Penh
   BAKONG_BASE_URL=https://api-bakong.nbc.gov.kh/v1
   ```
3. Add `backend/serviceAccountKey.json` (Firebase Admin credentials) for phone auth login.
4. Ensure MySQL is running and the database exists; adjust `DATABASE_URL` accordingly.
5. Initialize data (optional scripts):
   - `npm run init-db` – seed baseline tables/data.
   - `npm run reset-db` – drop/recreate schema (destructive).
6. Start the API: `npm run start` (uses `server.js`).

Key endpoints (non-exhaustive):
- `POST /auth/login` – email/password login.
- `POST /api/auth/firebase-login` – Firebase phone auth token exchange.
- `GET /products` and `GET /products/search` – public catalog.
- `GET/POST/PUT /admin/products` – admin CRUD (JWT + admin role).

Uploads are served from `/uploads` (banners and products stored under `backend/uploads/`).

### Admin Web (Vite + React)

1. `cd frontend && npm install`
2. Run dev server: `npm run dev` (default on `http://localhost:5173`).
3. Build for production: `npm run build` then `npm run preview` to serve.
4. The app expects the backend base URL and auth token handling to be wired via the axios service layer (`src/services`). Add a `.env` if you introduce Vite env vars (e.g., `VITE_API_BASE_URL`).

### Mobile App (Flutter)

1. Install Flutter 3.9+ SDK.
2. `cd mobile_shopease && flutter pub get`
3. Add Firebase configs for each platform if you use Firebase Auth (e.g., `google-services.json`, `GoogleService-Info.plist`).
4. Run on a device/emulator: `flutter run` (ensure backend base URL and allowed origins are reachable from the device).
5. Assets are under `assets/images/`; uses provider, shared_preferences, KHQR, and Firebase auth flows.

## Development Notes

- API CORS defaults allow `localhost:5173` and `localhost:3000`; configure `ALLOWED_ORIGINS` for production.
- Bakong integration uses KHQR generation and transaction verification; set tokens/merchant metadata in env.
- Firebase Admin init is optional but required for `/api/auth/firebase-login` phone auth path.
- Database helper lives in `src/config/database.js` and requires `DATABASE_URL`; the server logs connection diagnostics on startup.
- Uploaded media lives in `backend/uploads/`; consider mounting durable storage in production.

## Scripts Reference

Backend (from `backend/package.json`):
- `npm run start` – launch Express API.
- `npm run init-db` – initialize database data.
- `npm run reset-db` – reset database (destructive).

Frontend (from `frontend/package.json`):
- `npm run dev` – Vite dev server.
- `npm run build` – production build.
- `npm run preview` – serve built assets.
- `npm run lint` – run ESLint.

Flutter:
- `flutter run` – start app on connected device/emulator.
- `flutter test` – run widget/unit tests (none added yet by default).

## Production Checklist

- Set strong `JWT_SECRET` and restrict `ALLOWED_ORIGINS` to trusted domains.
- Provide valid Bakong token, merchant metadata, and TLS settings before enabling live payments.
- Supply Firebase Admin credentials for phone auth and mobile app configs per platform.
- Point `DATABASE_URL` to managed MySQL with backups and migrations; run schema init scripts.
- Serve static uploads via CDN or secured storage if needed.
- Enable HTTPS termination for both API and frontends.
