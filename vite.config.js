import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsxInject: `import React from 'react'`, // Add this line to inject React into JSX
  },
  optimizeDeps: {
    include: ["@babel/plugin-syntax-import-attributes"], // Add this line to include the required plugin
  },
});
