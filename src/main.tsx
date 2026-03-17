
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  // import "./styles/globals.css";
  import "./index.css";
  import { registerServiceWorker } from "./utils/offlineSync";
  import { enforceHttps } from "./utils/enforceHttps";
  import { initBotDetection } from "./utils/botDetection";

  // Redirect HTTP → HTTPS in production before anything else renders
  enforceHttps();

  // Start collecting interaction signals for bot/automation detection
  initBotDetection();

  // Register service worker for offline caching & background sync
  registerServiceWorker();

  createRoot(document.getElementById("root")!).render(<App />);
  