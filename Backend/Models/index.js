const sequelize = require("../Data/database");
const User = require("./User");
const Task = require("./Task");
const Response = require("./Response");
const Evidence = require("./Evidence");
const Message = require("./Message");
const TaskEvidence = require("./TaskEvidence");
const CustomerProfile = require("./CustomerProfile");

// User → Task (assigned tasks)
User.hasMany(Task, { foreignKey: "assignedTo" });
Task.belongsTo(User, { foreignKey: "assignedTo" });

// User → Response
User.hasMany(Response, { foreignKey: "UserId" });
Response.belongsTo(User, { foreignKey: "UserId" });

// Task → Response
Task.hasMany(Response, { foreignKey: "TaskId" });
Response.belongsTo(Task, { foreignKey: "TaskId" });

// User → Evidence (owner/creator)
User.hasMany(Evidence, { foreignKey: "UserId" });
Evidence.belongsTo(User, { foreignKey: "UserId" });

// Task ↔ Evidence (many-to-many through a single, canonical table)
// Use the explicit join model to match schema (composite PK, no timestamps)
Task.belongsToMany(Evidence, { through: TaskEvidence, foreignKey: "TaskId", otherKey: "EvidenceId" });
Evidence.belongsToMany(Task, { through: TaskEvidence, foreignKey: "EvidenceId", otherKey: "TaskId" });

// Message → User (sender and receiver)
Message.belongsTo(User, { as: "fromUser", foreignKey: "fromUserId" });
Message.belongsTo(User, { as: "toUser", foreignKey: "toUserId" });

// Customer profile ↔ User
User.hasOne(CustomerProfile, { foreignKey: "UserId", as: "customerProfile", onDelete: "CASCADE" });
CustomerProfile.belongsTo(User, { foreignKey: "UserId", as: "user" });

module.exports = {
  sequelize,
  User,
  Task,
  Response,
  Evidence,
  Message,
  TaskEvidence,
  CustomerProfile,
};