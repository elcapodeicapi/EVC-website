const { DataTypes } = require("sequelize");
const sequelize = require("../Data/database");
const User = require("./User");

const Message = sequelize.define("Message", {
  content: { type: DataTypes.TEXT, allowNull: false },
  read: { type: DataTypes.BOOLEAN, defaultValue: false }
});


module.exports = Message;
