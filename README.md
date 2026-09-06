# ChurnShield AI - Explainable Customer Churn Prediction

ChurnShield AI is a full-stack churn prediction app: a React client, a **Node.js + Express** API, and a **Python ML microservice** that runs the pre-trained logistic regression model and SHAP explanations.

The old Flask application server (`server/`) has been removed. Python remains only for model inference (`ml-service/`). Node.js owns auth, MongoDB, batch jobs, email, and S3.

---

## Architecture

| Service | Stack | Default port |
|---|---|---|
| Client | React (Vite) + Tailwind | 5173 |
| API | Node.js + Express + Mongoose | 5000 |
| ML | Flask + scikit-learn + SHAP | 5001 |
| Database | MongoDB 7 | 27017 |

The browser talks only to the Node API (`VITE_API_URL`). The API calls `ML_SERVICE_URL` for `/predict` and `/predict/batch`.

---

## Folder structure

```
customer-churn/
├── client/          React frontend
├── backend/         Node.js API
├── ml-service/      Python inference + SHAP
├── model/           Training notebook and model artifacts
├── customer_churn.csv
└── docker-compose.yml
```

---

## What you must do manually

### 1. Copy environment files

```bash
cp backend/.env.example backend/.env
cp client/.env.example client/.env
```

### 2. Fill `backend/.env`

| Variable | Required? | What to put |
|---|---|---|
| `SECRET_KEY` | Yes for production | Random string used to sign login captchas |
| `JWT_SECRET_KEY` | Yes for production | Random string used to sign session JWTs |
| `MONGO_URI` | Yes unless `DEMO_MODE=true` | Local `mongodb://localhost:27017/churn_db` or an Atlas URI |
| `ML_SERVICE_URL` | Yes | `http://localhost:5001` locally, or the ML service URL in Docker/cloud |
| `CORS_ORIGIN` | Yes in production | Your frontend origin(s), comma-separated. Example: `https://your-app.vercel.app` |
| `PUBLIC_BASE_URL` | If you skip S3 | Public URL of the API, used for local avatar files |
| `GOOGLE_CLIENT_ID` | For real Google login | Same **Web client ID** as in `client/.env` |
| `SMTP_USER` / `SMTP_PASSWORD` | For real email OTP | Gmail address + [App Password](https://myaccount.google.com/apppasswords) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET` | For S3 avatars | IAM user with `s3:PutObject` and `s3:DeleteObject` on the bucket. Bucket should allow public reads of `avatars/*` **or** you keep local disk storage |

Leave SMTP blank to print the 6-digit OTP in the **Node.js terminal**. Leave AWS blank to store profile photos under `backend/uploads/avatars`.

Set `DEMO_MODE=true` only for local demos when MongoDB is not installed. Data lives in memory and is wiped when the API process exits.

### 3. Fill `client/.env`

| Variable | Required? | What to put |
|---|---|---|
| `VITE_API_URL` | Yes | `http://localhost:5000` locally, or your deployed API URL (no trailing slash) |
| `VITE_GOOGLE_CLIENT_ID` | For real Google login | Google Cloud **OAuth 2.0 Client ID** (Web application). Add `http://localhost:5173` to Authorized JavaScript origins |

If `VITE_GOOGLE_CLIENT_ID` is empty, the UI uses a mock Google user (`demo_google_user@gmail.com`).

Vite bakes these values in at **build time**. After changing them, restart `npm run dev` or rebuild for production.

### 4. Place the trained model file

The ML service loads:

- `ml-service/model/columns.json` (already in the repo)
- `ml-service/model/churn_model.pickle` **or** `model/churn_model.pickle`

If the pickle is missing, copy it from your training output (`model/` after running the notebook) into `ml-service/model/churn_model.pickle`. Predictions will not start without it.

### 5. Install MongoDB (or skip with demo / Docker)

- Local: [MongoDB Community](https://www.mongodb.com/try/download/community) on port 27017, **or**
- Atlas connection string in `MONGO_URI`, **or**
- `docker compose up mongodb`, **or**
- `DEMO_MODE=true` (non-persistent)

### 6. Google Cloud (optional)

1. Create an OAuth client of type **Web application**.
2. Authorized JavaScript origins: `http://localhost:5173` and your production frontend URL.
3. Authorized redirect URIs: same origins (GIS button login does not need a redirect path).
4. Paste the client ID into **both** `client/.env` (`VITE_GOOGLE_CLIENT_ID`) and `backend/.env` (`GOOGLE_CLIENT_ID`).

### 7. AWS S3 (optional)

1. Create a bucket.
2. Create an IAM user with put/delete on `avatars/*`.
3. Put credentials in `backend/.env`.
4. Make object URLs readable by the browser (bucket policy or CloudFront). If the bucket is private, avatars will 403 in the UI unless you switch to signed URLs later.

---

## Local development

Prerequisites: **Node.js 18+**, **Python 3.9+**, **MongoDB** (or `DEMO_MODE=true`).

### ML service (required for predictions)

```bash
cd ml-service
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Listens on `http://localhost:5001`.

### Node.js API

```bash
cd backend
cp .env.example .env   # then edit secrets
npm install
npm run dev
```

Listens on `http://localhost:5000`. Health: `GET http://localhost:5000/api/health`.

### React client

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Opens `http://localhost:5173`.

---

## Docker Compose (all services)

```bash
cp backend/.env.example backend/.env
# edit JWT secrets, SMTP, AWS, Google as needed
docker compose up --build
```

- Client: http://localhost:5173  
- API: http://localhost:5000  
- ML: http://localhost:5001  

Inside Compose, `MONGO_URI` and `ML_SERVICE_URL` are overridden to the internal hostnames `mongodb` and `ml-service`.

---

## Production deploy (typical split)

1. **MongoDB** — Atlas (or a managed Mongo instance). Put the URI in `MONGO_URI`.
2. **ML service** — any host that can run Docker or Python (Render, Fly.io, a VM). Expose port 5001 (or whatever `ML_PORT` is). Give it CPU; SHAP and sklearn are not tiny. Set `ML_PORT` in the platform.
3. **Node API** — Node 20 host (Render, Railway, Fly, VM). Set `PORT` to what the platform assigns. Set `ML_SERVICE_URL` to the public/internal ML URL, `MONGO_URI`, `CORS_ORIGIN` to the frontend origin, `PUBLIC_BASE_URL` to the API’s public URL, and the JWT/SMTP/S3/Google secrets.
4. **Client** — Vercel or Netlify static build. Set `VITE_API_URL` to the **public** Node API origin before `npm run build`. Set `VITE_GOOGLE_CLIENT_ID` if you use Google login.

The API does not serve the React app; the frontend is a separate static site.

Health check path for the API: `/api/health`.  
Health check path for ML: `/health`.

Do not commit `.env` files. Rotate `SECRET_KEY` and `JWT_SECRET_KEY` if they ever leaked.

---

## Auth fallbacks (portfolios / local)

- **Google:** without a client ID, “Continue with Google” signs in as `demo_google_user@gmail.com`.
- **OTP:** without SMTP, the 6-digit code is printed in the Node API terminal.

---

## Jupyter notebook

The dataset is at the project root. In `model/` notebooks, load:

```python
df = pd.read_csv("../customer_churn.csv")
```
