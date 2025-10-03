const { sequelize, Task } = require("./Models");

const tasks = [
  {
    title: "B1-K1-W1 Onderzoekt de behoefte aan sociaal werk",
    description: "De sociaal werker onderzoekt de situatie en behoeften van de cliënt."
  },
  {
    title: "B1-K1-W2 Maakt plan van aanpak",
    description: "De sociaal werker stelt een plan van aanpak op samen met de cliënt."
  },
  {
    title: "B1-K2-W1 Begeleidt cliënt bij uitvoeren van plan",
    description: "De sociaal werker ondersteunt en begeleidt de cliënt tijdens de uitvoering."
  }
  // 👉 add more from your portfolio framework here
];

async function seed() {
  try {
    await sequelize.sync(); 

    for (let task of tasks) {
      await Task.findOrCreate({
        where: { title: task.title },
        defaults: task
      });
    }

    console.log("✅ Tasks seeded successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding tasks:", err);
    process.exit(1);
  }
}

seed();
