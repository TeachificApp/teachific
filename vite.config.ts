import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// Only include dev-only JSX location metadata in development mode.
const isDev = process.env.NODE_ENV !== 'production';
const plugins = [
  react(),
  tailwindcss(),
  ...(isDev ? [jsxLocPlugin()] : []),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // IMPORTANT: Do NOT put react/react-dom in a separate chunk from the rest of node_modules
          // Doing so creates circular dependencies (vendor-react <-> vendor-misc) that deadlock the app
          // All react-dependent libs (tanstack, radix, etc.) call React.createContext() at init time
          // which fails if React is in a separate chunk that hasn't finished evaluating yet

          // Vendor: Charts (recharts is large, no circular deps with react)
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory')) {
            return 'vendor-charts';
          }
          // Vendor: Lucide icons (large, no circular deps)
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // NOTE: tiptap/prosemirror must NOT be in a separate chunk — prosemirror-state has
          // a temporal dead zone circular dependency with @tiptap/core that causes
          // "Cannot access 'nt' before initialization" at runtime in production builds.
          // They are intentionally left to fall through to vendor-misc.

          // Vendor: codemirror code editor (large, no circular deps)
          if (id.includes('node_modules/@codemirror/') || id.includes('node_modules/@lezer/')) {
            return 'vendor-codemirror';
          }
          // Vendor: xlsx / spreadsheet (large, no circular deps)
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/jszip')) {
            return 'vendor-xlsx';
          }
          // Vendor: AWS SDK (S3, large, no circular deps)
          if (id.includes('node_modules/@aws-sdk/')) {
            return 'vendor-aws';
          }
          // All other node_modules go into vendor-misc (including react, react-dom, radix, trpc, etc.)
          // This avoids circular dependencies between react and its dependent libraries
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
