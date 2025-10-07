const express = require("express");
const cors = require("cors");
const path = require("path");
const { sequelize, User, Task, Evidence, Message, Response } = require("./Models");
const { authenticate, requireAdmin } = require("./Middleware/authMiddleware");


const taskRoutes = require("./routes/tasks");
const evidenceRoutes = require("./routes/evidence");
const messageRoutes = require("./routes/messages");
const authRoutes = require("./routes/auth");
const responseRoutes = require("./routes/responses");
const taskEvidenceRoutes = require("./routes/taskEvidence");

const app = express();
app.use(cors());
app.use(express.json());
// Serve uploaded files from the absolute uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Mount routes
app.use(express.static(path.join(__dirname, "../Frontend")));

app.use("/tasks", taskRoutes);
app.use("/evidence", authenticate, evidenceRoutes);
app.use("/evidence", evidenceRoutes);
app.use("/messages", messageRoutes);
app.use("/auth", authRoutes);
app.use("/responses", responseRoutes);
app.use("/taskevidence", authenticate, taskEvidenceRoutes);

// Start server
(async () => {
  // Then run a normal sync without alter
  await sequelize.sync();  // sync models to DB, altering tables if needed
  app.listen(4000, () => console.log("API running at http://localhost:4000"));
})();
