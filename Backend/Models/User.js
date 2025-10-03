const { DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");
const sequelize = require("../Data/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "user",
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
    ],
    hooks: {
      // Hash password when creating or updating if changed
      beforeCreate: async (user) => {
        if (user.password) {
          const saltRounds = 10;
          user.password = await bcrypt.hash(user.password, saltRounds);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          const saltRounds = 10;
          user.password = await bcrypt.hash(user.password, saltRounds);
        }
      },
    },
  }
);

// Instance method to validate a plain password
User.prototype.validatePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = User;
