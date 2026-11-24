# Khushil — Sahil × Khushi Private Couple App

Deploy free today on **Render** (no credit card required) or **Koyeb**, with optional **Supabase Storage** cloud persistence so your chats, snaps, streaks, and 11:11 wishes never reset when free containers sleep or restart.

## Deploy Free on Render (3 Minutes)
1. Push this folder to a GitHub repository.
2. Open Render -> **New +** -> **Web Service** (or **Blueprint** to auto-read `render.yaml`).
3. Pick **Free** instance type, Runtime **Node**, Build Command `npm install`, Start Command `npm start`.
4. Add Environment Variables:
   - `APP_PASSCODE` = your secret couple PIN (e.g., `1111`)
   - `SUPABASE_URL` = your Supabase Project URL
   - `SUPABASE_SERVICE_KEY` = your Supabase `service_role` key
   - `SUPABASE_BUCKET` = `khushil-data`
5. Click **Create Web Service** and check `/health` -> should show `"storage": "supabase"`.
