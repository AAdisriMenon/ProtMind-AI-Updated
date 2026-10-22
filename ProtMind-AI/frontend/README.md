# ProtMind AI Frontend

React + Vite frontend for ProtMind AI.

## Run

```bash
npm install
npm run dev
```

## Hero image

Place your molecular/protein image at:

`public/hero.png`

The homepage hero automatically uses `/hero.png` as a full-screen background.

## Step 1

Step 1 is intentionally input-only. It contains:
- UniProt ID OR FASTA sequence
- Mutation
- Optional chain
- Analysis module selection

Unnecessary molecular preview, analysis journey and data-source sidebar elements are not included.

Authentication is currently frontend/local-state only and can be connected to FastAPI/PostgreSQL later.


### ProtMind AI Logo
The application header and browser favicon use `public/protmind-logo.jpeg`.
