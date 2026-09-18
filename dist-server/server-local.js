// Local development server — starts the Express API on port 5000
// Run with: npx tsx api/server-local.ts
// Keep this open alongside `npm run dev` (Vite on port 3000)
import app from './index.js';
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`[DEV] ✅ Local API server running at http://localhost:${PORT}`);
    console.log(`[DEV]    Frontend proxy: http://localhost:3000/api/* → http://localhost:${PORT}/api/*`);
});
