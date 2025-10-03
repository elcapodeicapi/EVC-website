const { Sequelize } = require("sequelize");
const path = require("path");


const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(__dirname, "evc.db")
});

module.exports = sequelize;
