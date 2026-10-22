# ProtMind AI — React frontend + FastAPI backend

The Streamlit app is replaced by your React frontend. All 10 steps are kept in the same order and use the
same logic (`backend/backend.py` is your original file with only the Streamlit CSS helper removed).

## Run
```bash
# 1) Backend (port 8000)
cd backend
pip install -r requirements.txt
uvicorn api:app --reload --port 8000

# 2) Frontend (port 5173, proxies /api to the backend)
cd frontend
npm install
npm run dev
```
For a deployed backend set `VITE_API_URL=https://your-api` before `npm run build`.

## Step map
| Step | Streamlit page | React component | API route |
|---|---|---|---|
| 1 | 1_User_Input | Step1 | POST /api/step1/validate |
| 2 | 2_Data_Retrieval | Step2 | POST /api/step2 |
| 3 | 3_Preprocessing | Step3 | POST /api/step3 |
| 4 | 4_Mutation_Analysis | Step4 | POST /api/step4 |
| 5 | 5_Structure_Prediction | Step5 (3Dmol.js) | POST /api/step5 |
| 6 | 6_Thermodynamic_Stability | Step6 | POST /api/step6 |
| 7 | 7_Stereochemical_Validation | Step7 (Plotly) | POST /api/step7 |
| 8 | 8_Explainable_AI | Step8 | (static text) |
| 9 | 9_Therapeutic_Targeting | Step9 | POST /api/step9 |
| 10 | 10_Clinical_Report | Step10 | POST /api/step10/pdf |
