import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "@/providers/SessionProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PinOverlay } from "@/components/PinOverlay";
import App from "./App";
import "./index.css";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
  });
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ConvexProvider client={convex}>
        <PinOverlay>
          <SessionProvider>
            <App />
          </SessionProvider>
        </PinOverlay>
      </ConvexProvider>
    </ErrorBoundary>
  </StrictMode>,
);
