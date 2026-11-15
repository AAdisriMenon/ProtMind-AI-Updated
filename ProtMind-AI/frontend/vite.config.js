import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev: forward /api and /predict-step9 calls to the FastAPI backend (uvicorn api:app --port 8000 or fastapi_app.py)
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/predict-step9': 'http://localhost:8000',
    },
  },
})
