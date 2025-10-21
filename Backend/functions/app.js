const fs = require("fs");
const path = require("path");
let expressModule;
let corsModule;
let matchAllInstance;

function loadExpress() {
  if (!expressModule) {
    expressModule = require("express");
  }
  return expressModule;
}

function loadCors() {
  if (!corsModule) {
    corsModule = require("cors");
  }
  return corsModule;
}

function loadMatchAll() {
  if (!matchAllInstance) {
    matchAllInstance = require("path-match")({ sensitive: false, strict: false });
  }
  return matchAllInstance;
}
// Defer heavy initialization by exporting a factory instead of an app instance
function createApp() {
  const express = loadExpress();
  const cors = loadCors();
  const matchAll = loadMatchAll();
  const evidenceRoutes = require("./routes/evidence");
  const messageRoutes = require("./routes/messages");
  const authRoutes = require("./routes/auth");
  const customerRoutes = require("./routes/customer");
  const trajectRoutes = require("./routes/trajects");

  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5000",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:3000",
    "https://evcwebsite12345.web.app",
    "https://evcwebsite12345.firebaseapp.com",
  ];
  function isAllowedOrigin(origin) {
    if (!origin) return true; // same-origin or server-to-server
    if (allowedOrigins.includes(origin)) return true;
    try {
      const u = new URL(origin);
      const host = u.hostname.toLowerCase();
      if (host.endsWith(".web.app") || host.endsWith(".firebaseapp.com")) return true;
    } catch (_) {
      return false;
    }
    return false;
  }

  const app = express();

  const corsOptions = {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed for this origin"));
      }
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  };
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));

  const jsonParser = express.json({ limit: "10mb" });
  const urlencodedParser = express.urlencoded({ extended: true, limit: "10mb" });
  app.use((req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.startsWith("multipart/form-data")) {
      return next();
    }
    if (contentType.startsWith("application/x-www-form-urlencoded")) {
      return urlencodedParser(req, res, next);
    }
    return jsonParser(req, res, next);
  });

  const uploadsDir = path.join(__dirname, "uploads");
  if (fs.existsSync(uploadsDir)) {
    app.use("/uploads", express.static(uploadsDir));
  }

  const clientDistCandidates = [
    path.resolve(__dirname, "../cliet/dist"),
    path.resolve(__dirname, "../../cliet/dist"),
    path.resolve(__dirname, "../client/dist"),
    path.resolve(__dirname, "../../client/dist"),
  ];
  const clientDistPath = clientDistCandidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "index.html"))
  );
  const hasClientBuild = Boolean(clientDistPath);

  if (hasClientBuild) {
    app.use(express.static(clientDistPath));
  }

  app.use((req, _res, next) => {
    if (req.url === "/api") {
      req.url = "/";
    } else if (req.url.startsWith("/api/")) {
      req.url = req.url.replace(/^\/api/, "") || "/";
    }
    next();
  });

  app.use("/evidence", evidenceRoutes);
  app.use("/messages", messageRoutes);
  app.use("/auth", authRoutes);
  app.use("/customer", customerRoutes);
  app.use("/trajects", trajectRoutes);

  const apiPrefixes = [
    "/auth",
    "/evidence",
    "/messages",
    "/trajects",
    "/uploads",
    "/customer",
  ];
  const isNonApiRoute = matchAll("/*");

  app.use((req, res, next) => {
    if (apiPrefixes.some((prefix) => req.path.startsWith(prefix))) {
      return next();
    }
    if (!isNonApiRoute(req.path) || !hasClientBuild) {
      return next();
    }
    return res.sendFile(path.join(clientDistPath, "index.html"));
  });

  return app;
}

module.exports = createApp;
