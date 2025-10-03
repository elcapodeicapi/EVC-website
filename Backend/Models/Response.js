const { DataTypes } = require("sequelize");
const sequelize = require("../Data/database");
const Task = require("./Task");
const User = require("./User");

const Response = sequelize.define("Response", {
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});




module.exports = Response;
