
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  // import "./styles/globals.css";
  import "./index.css";
  import { registerServiceWorker } from "./utils/offlineSync";

  // Register service worker for offline caching & background sync
  registerServiceWorker();

  createRoot(document.getElementById("root")!).render(<App />);
  