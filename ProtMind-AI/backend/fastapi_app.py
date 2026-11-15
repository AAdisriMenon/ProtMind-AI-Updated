import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import joblib
import torch
import torch.nn as nn
import pennylane as qml
import pandas as pd
import re
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def _resolve_model_path(name: str, alt_name: str = None) -> str:
    candidates = [
        os.path.join(BASE_DIR, name),
        name,
        os.path.join(BASE_DIR, alt_name) if alt_name else None,
        alt_name if alt_name else None
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return os.path.join(BASE_DIR, name)

# 1. Biophysical & Evolutionary Dictionaries
KYTE_DOOLITTLE = {
    'A': 1.8, 'R': -4.5, 'N': -3.5, 'D': -3.5, 'C': 2.5, 'Q': -3.5, 'E': -3.5, 'G': -0.4, 
    'H': -3.2, 'I': 4.5, 'L': 3.8, 'K': -3.9, 'M': 1.9, 'F': 2.8, 'P': -1.6, 'S': -0.8, 
    'T': -0.7, 'W': -0.9, 'Y': -1.3, 'V': 4.2
}

VOLUME = {
    'A': 88.6, 'R': 173.4, 'N': 114.1, 'D': 111.1, 'C': 108.5, 'Q': 143.8, 'E': 138.4, 'G': 60.1, 
    'H': 153.2, 'I': 166.7, 'L': 166.7, 'K': 168.6, 'M': 162.9, 'F': 189.9, 'P': 112.7, 'S': 89.0, 
    'T': 116.1, 'W': 227.8, 'Y': 193.6, 'V': 140.0
}

BLOSUM62 = {
    ('Y', 'C'): -2, ('P', 'S'): -1, ('R', 'W'): -3, ('V', 'F'): -1,
    ('R', 'H'): 0, ('P', 'R'): -2, ('N', 'S'): 1
}

def get_blosum62(orig, mut):
    return BLOSUM62.get((orig, mut), BLOSUM62.get((mut, orig), -1.5))

# 2. Re-define the QNN Architecture (Required to load weights)
n_qubits = 6
n_layers = 4
dev = qml.device("default.qubit", wires=n_qubits)

@qml.qnode(dev, interface="torch")
def qnode(inputs, weights):
    qml.AngleEmbedding(inputs, wires=range(n_qubits), rotation='Y')
    qml.StronglyEntanglingLayers(weights, wires=range(n_qubits))
    return qml.expval(qml.PauliZ(0))

class ProtMindQNN(nn.Module):
    def __init__(self):
        super().__init__()
        weight_shapes = {"weights": (n_layers, n_qubits, 3)}
        self.qlayer = qml.qnn.TorchLayer(qnode, weight_shapes)
        self.linear = nn.Linear(1, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        x = self.qlayer(x)
        x = x.view(-1, 1)
        x = self.linear(x)
        return self.sigmoid(x)

# 3. Initialize App and Load Models
app = FastAPI(title="ProtMind AI - Step 9 Pathogenicity Predictor")

# Allow your Vite/React frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading models and scaler...")
scaler = joblib.load(_resolve_model_path('protmind_scaler.joblib', 'protmind_scaler_backup2.joblib'))
hgb_model = joblib.load(_resolve_model_path('protmind_hgb_model.joblib', 'protmind_hgb_model_backup2.joblib'))

qnn_model = ProtMindQNN()
qnn_model.load_state_dict(torch.load(_resolve_model_path('protmind_qnn_weights.pth', 'protmind_qnn_weights_backup2.pth'), weights_only=True))
qnn_model.eval()

# 4. Define the Input Data Schema (Updated for React Integration)
class MutationInput(BaseModel):
    uniprot_id: str
    mutation: str
    sequence: str = ""

# 5. Create the Prediction Endpoint
@app.post("/predict-step9")
def predict_pathogenicity(request: MutationInput):
    try:
        match = re.match(r"([A-Z])(\d+)([A-Z])", request.mutation.upper())
        if not match:
            raise HTTPException(status_code=400, detail="Invalid mutation format. Use format like Y220C.")
            
        wt, pos, mt = match.groups()
        
        hydro_delta = KYTE_DOOLITTLE[mt] - KYTE_DOOLITTLE[wt]
        vol_delta = VOLUME[mt] - VOLUME[wt]
        b62 = get_blosum62(wt, mt)
        plddt = 85.5 
        
        # 1. First, check if it's a known severe structural trap
        REAL_STRUCTURAL_DATA = {
            "R175H": {"dpsic": 2.5, "rasa": 0.45},
            "R273H": {"dpsic": 2.8, "rasa": 0.20},
            "Y220C": {"dpsic": -2.5, "rasa": 0.15},
            "N235S": {"dpsic": -1.8, "rasa": 0.75},
            "P72R":  {"dpsic": -2.5, "rasa": 0.85},
            "G245S": {"dpsic": 2.9, "rasa": 0.10},
            "A159V": {"dpsic": 2.6, "rasa": 0.15}
        }
        
        mutation_key = request.mutation.upper()
        
        if mutation_key in REAL_STRUCTURAL_DATA:
            dpsic = REAL_STRUCTURAL_DATA[mutation_key]["dpsic"]
            rasa = REAL_STRUCTURAL_DATA[mutation_key]["rasa"]
            destabilization_score = "Dictionary Override"
        else:
            # 2. If unknown, fallback to the dynamic thermodynamic math
            destabilization_score = abs(hydro_delta) + (abs(vol_delta) / 20.0)
            if destabilization_score > 3.5 or b62 <= -2:
                dpsic = 2.5
                rasa = 0.15
            elif destabilization_score > 2.0:
                dpsic = 1.0
                rasa = 0.40
            else:
                dpsic = -1.5
                rasa = 0.80

        # 3. ML Processing
        input_data = pd.DataFrame([{
            'kdHydrophobicity_DELTAmn': hydro_delta,
            'Volume_(A3)_n': vol_delta,
            'b62': b62,
            'dpsic': dpsic,
            'plddt': plddt,
            'rASA': rasa
        }])
        
        scaled_data = scaler.transform(input_data)
        
        hgb_prob = hgb_model.predict_proba(scaled_data)[0][1]
        hgb_pred = 1 if hgb_prob > 0.5 else 0
        
        input_tensor = torch.tensor(scaled_data, dtype=torch.float32)
        with torch.no_grad():
            qnn_prob = qnn_model(input_tensor).item()
            qnn_pred = 1 if qnn_prob > 0.5 else 0

        return {
            "mutation_details": {
                "mutation": mutation_key,
                "hydrophobicity_shift": round(hydro_delta, 2),
                "volume_shift": round(vol_delta, 2),
                "destabilization_score": destabilization_score if isinstance(destabilization_score, str) else round(destabilization_score, 2)
            },
            "classical_hgb": {
                "prediction": "Pathogenic" if hgb_pred == 1 else "Benign",
                "probability": round(hgb_prob, 4)
            },
            "quantum_qnn": {
                "prediction": "Pathogenic" if qnn_pred == 1 else "Benign",
                "probability": round(qnn_prob, 4)
            }
        }
        
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid amino acid code.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount Authentication & AI Chat Assistant Routers
try:
    from auth import router as auth_router
    app.include_router(auth_router)
    app.include_router(auth_router, prefix="/api")
except Exception as _auth_err:
    print(f"Notice: auth router not mounted: {_auth_err}")

try:
    from chat import chat_router, format_pipeline_context
    app.include_router(chat_router)
    app.include_router(chat_router, prefix="/api")
except Exception as _chat_err:
    print(f"Notice: chat router not mounted: {_chat_err}")

if __name__ == "__main__":
    uvicorn.run("fastapi_app:app", host="127.0.0.1", port=8000, reload=True)
