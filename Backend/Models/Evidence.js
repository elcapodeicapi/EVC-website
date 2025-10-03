const { DataTypes } = require("sequelize");
const sequelize = require("../Data/database");
const Task = require("./Task");
const User = require("./User");

const Evidence = sequelize.define("Evidence", {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING, // e.g. Diploma, CV, Beroepsproduct
    allowNull: true
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: false
  }
});


module.exports = Evidence;
