const { sequelize } = require("./Models");

async function seed() {
  try {
    await sequelize.sync();
    console.log("✅ Database synced (no legacy seed data required)");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error syncing database:", err);
    process.exit(1);
  }
}

seed();
