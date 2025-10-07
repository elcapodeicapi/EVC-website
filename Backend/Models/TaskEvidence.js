const { DataTypes } = require("sequelize");
const sequelize = require("../Data/database");

// Canonical join table uses plural table name
// Align with existing SQLite table that likely has only TaskId and EvidenceId (no id column)
const TaskEvidence = sequelize.define(
  "TaskEvidence",
  {
    TaskId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    EvidenceId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
  },
  {
    tableName: "TaskEvidences",
    // Redundant given composite PK, but keeps intent explicit if schema changes later
    indexes: [{ unique: true, fields: ["TaskId", "EvidenceId"] }],
  }
);



module.exports = TaskEvidence;
