// Load environment variables as early as possible
(() => {
  try {
    const fs = require("fs");
    const path = require("path");
    const dotenv = require("dotenv");
    const candidates = [
      path.resolve(__dirname, "../.env"),
      path.resolve(__dirname, ".env"),
      path.resolve(__dirname, "../cliet/.env"),
    ];
    candidates.forEach((file) => {
      if (fs.existsSync(file)) {
        dotenv.config({ path: file, override: false });
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("dotenv load skipped:", error?.message || error);
  }
})();

const createApp = require("./functions/app");
const { db: fbDb, auth: fbAuth } = require("./functions/firebase");

const port = Number(process.env.PORT) || 5000;
const app = createApp();
app.listen(port, () => console.log(`API running at http://localhost:${port}`));

module.exports = { app, fbDb, fbAuth };
