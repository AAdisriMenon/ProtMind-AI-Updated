import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev: forward /api calls to the FastAPI backend (uvicorn api:app --port 8000)
  server: { proxy: { '/api': 'http://localhost:8000' } },
})
