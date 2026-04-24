import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Minimal Vite config for testing
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
  },
});