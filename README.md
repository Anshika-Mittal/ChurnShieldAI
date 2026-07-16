# ChurnShield AI - Explainable Customer Churn Prediction System

ChurnShield AI is a production-grade, full-stack Customer Churn Prediction web application wrapping a pre-trained Logistic Regression machine learning model. It is designed to evaluate churn risk probabilities and explain predictive outcomes in clear business terms using local SHAP (SHapley Additive exPlanations) values.

---

## 🚀 Key Features
- **Explainable AI (SHAP)**: Horizontal contribution charts illustrating which customer traits drive risk up or down.
- **Natural Language Explanations**: Automated business summaries translating model features into descriptive paragraphs.
- **Robust Security**: JWT authorization, bcrypt password hashing, input sanitization, and stateless arithmetic login Captchas.
- **Dual Authentication**: Password-based signup with 5-minute email OTP verification and Google OAuth integration.
- **Interactive Visualizations**: Real-time batch predictions (up to 10000 records) styled with custom Recharts visual distributions.
- **Resilient Mock Mode**: Seamless in-memory fallback database and terminal-logged OTP mode if MongoDB or SMTP are offline.

---

## 📂 Folder Structure
```
Customer-Churn-Prediction/
├── client/                 # React (Vite) + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/     # Skeletons, Sidebars, Headers
│   │   ├── context/        # Auth and Light/Dark Theme Contexts
│   │   ├── pages/          # Landing, Dashboard, Profile, Predictions
│   │   └── services/       # Fetch API wrapper
│   └── index.html          # Entry HTML & metadata
├── server/                 # Python Flask Backend
│   ├── artifacts/          # Pre-trained model & columns schema
│   ├── database/           # MongoDB Connection pooling and CRUD layer
│   ├── middleware/         # JWT request validator
│   ├── routes/             # Authentication & Prediction blueprints
│   ├── services/           # SMTP OTP, predictions engine & SHAP calculator
│   ├── server.py           # Main startup entrypoint
│   └── config.py           # Configuration values
├── model/                  # Data Science notebooks & backup assets
│   ├── churn_prediction.ipynb
│   ├── churn_model.pickle
│   └── columns.json
├── customer_churn.csv      # Primary dataset
└── README.md               # Setup Guide
```

---

## 📓 Jupyter Notebook Path Update

Because the notebook is located inside the `model/` folder while the primary dataset resides at the project root, update the file loading reference in your notebook from:
```python
df = pd.read_csv("telecom_customer_churn.csv") # or "customer_churn.csv"
```
to the relative parent path:
```python
df = pd.read_csv("../customer_churn.csv")
```

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- MongoDB (Optional, falls back to In-Memory mode if not running)

### 1. Backend Server Setup
1. Open a terminal and navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   pip install flask flask-cors pymongo dnspython bcrypt pyjwt shap pandas scikit-learn numpy
   ```
3. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```
4. Run the Flask server:
   ```bash
   python server.py
   ```
   *The server starts on `http://localhost:5000` by default. If a local MongoDB instance is not detected, it will automatically activate **Demo Mode** using an in-memory data store.*

### 2. Frontend Client Setup
1. Open a new terminal and navigate to the `client/` directory:
   ```bash
   cd client
   ```
2. Install npm node modules:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   *The client opens on `http://localhost:5173`. Toggle between Light and Dark mode using the sun/moon icon in the top header.*

---

## 🛡️ Authentication Fallbacks (For Portfolios)
- **Google OAuth**: Click "Continue with Google" to automatically log in using a pre-configured Mock Developer profile (`demo_google_user@gmail.com`) if you haven't filled in client ID parameters.
- **Email OTP**: If SMTP credentials (`SMTP_USER`, `SMTP_PASSWORD`) are omitted in `server/.env`, the system runs in **Console mode**, printing the 6-digit verification code directly inside your backend terminal window for copy-paste registration.
