import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SessionProvider } from "@/providers/SessionProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import App from "./App";
import "./index.css";

// Apply the saved colour theme before first paint to avoid a flash.
applyTheme(getStoredTheme());

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (dsn) {
  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.2,
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <SessionProvider>
        <App />
      </SessionProvider>
    </ErrorBoundary>
  </StrictMode>,
);
