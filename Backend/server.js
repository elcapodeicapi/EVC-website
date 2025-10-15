const express = require("express");
const cors = require("cors");
const path = require("path");
const { sequelize } = require("./Models");
const { db: fbDb, auth: fbAuth } = require("./firebase");

const evidenceRoutes = require("./routes/evidence");
const messageRoutes = require("./routes/messages");
const authRoutes = require("./routes/auth");
const customerRoutes = require("./routes/customer");
const trajectRoutes = require("./routes/trajects");

const app = express();
app.use(cors());
app.use(express.json());
// Serve uploaded files from the absolute uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve React build (Vite output) from /cliet/dist
const clientDistPath = path.resolve(__dirname, "../cliet/dist");
app.use(express.static(clientDistPath));

app.use("/evidence", evidenceRoutes);
app.use("/messages", messageRoutes);
app.use("/auth", authRoutes);
app.use("/customer", customerRoutes);
app.use("/trajects", trajectRoutes);

const matchAll = require("path-match")({ sensitive: false, strict: false });
const isNonApiRoute = matchAll("/*");

// SPA fallback: for non-API routes, return index.html so React Router can handle it
app.use((req, res, next) => {
  const apiPrefixes = [
    "/auth",
    "/evidence",
    "/messages",
    "/trajects",
    "/uploads",
    "/customer",
  ];
  if (apiPrefixes.some((p) => req.path.startsWith(p))) return next();
  if (!isNonApiRoute(req.path)) return next();
  res.sendFile(path.join(clientDistPath, "index.html"));
});

// Start server
(async () => {
  await sequelize.sync();
  app.listen(5000, () => console.log("API running at http://localhost:5000"));
})();

// Optionally expose admin clients for other modules (if this file is imported elsewhere)
module.exports = { app, fbDb, fbAuth };
