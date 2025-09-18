import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import MemoryStore from "memorystore";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { cleanupScheduler } from "./cleanup-scheduler";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure session store based on environment
const createSessionStore = () => {
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    // Use PostgreSQL session store for production
    const PgStore = ConnectPgSimple(session);
    return new PgStore({
      conString: process.env.DATABASE_URL,
      tableName: 'admin_sessions',
      createTableIfMissing: true,
    });
  } else {
    // Use memory store for development with TTL
    return new (MemoryStore(session))({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }
};

// Configure express-session with secure settings
app.use(session({
  name: 'admin_session_id', // Don't use default 'connect.sid'
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production-12345',
  store: createSessionStore(),
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 1000 * 60 * 60 * 2, // 2 hours
    sameSite: 'strict' // CSRF protection
  }
}));

// Serve attached assets statically
app.use('/attached_assets', express.static(path.resolve(import.meta.dirname, '../attached_assets')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Log cleanup scheduler status
    const status = cleanupScheduler.getStatus();
    console.log(`[CLEANUP] Scheduler active: ${status.isScheduled ? 'Yes' : 'No'}, keeping ${status.messagesPerRoom} messages per room`);
    
    // Initialize system admin users
    const { initializeSystemAdmins } = await import('./startup');
    await initializeSystemAdmins();
  });
})();
