const { DataTypes } = require("sequelize");
const sequelize = require("../Data/database");

const CustomerProfile = sequelize.define(
  "CustomerProfile",
  {
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    placeOfBirth: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    nationality: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phoneFixed: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phoneMobile: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    street: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    houseNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    addition: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    postalCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "CustomerProfiles",
  }
);

module.exports = CustomerProfile;
