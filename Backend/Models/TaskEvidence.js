const { DataTypes } = require("sequelize");
const sequelize = require("../Data/database");
const Task = require("./Task");
const Evidence = require("./Evidence");

const TaskEvidence = sequelize.define("TaskEvidence", {
  // no extra fields needed, Sequelize will create TaskId + EvidenceId
});



module.exports = TaskEvidence;
