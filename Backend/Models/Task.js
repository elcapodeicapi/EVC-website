const { DataTypes } = require("sequelize");
const sequelize = require("../Data/database");

const Task = sequelize.define("Task", {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  }
});

module.exports = Task;
