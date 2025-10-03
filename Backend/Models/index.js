const sequelize = require("../Data/database");
const User = require("./User");
const Task = require("./Task");
const Response = require("./Response");
const Evidence = require("./Evidence");
const Message = require("./Message");
const TaskEvidence = require("./TaskEvidence");

// User ↔ Task (assigned tasks)
User.hasMany(Task, { foreignKey: "assignedTo" });
Task.belongsTo(User, { foreignKey: "assignedTo" });

// User ↔ Response
User.hasMany(Response, { foreignKey: "UserId" });
Response.belongsTo(User, { foreignKey: "UserId" });

// Task ↔ Response
Task.hasMany(Response, { foreignKey: "TaskId" });
Response.belongsTo(Task, { foreignKey: "TaskId" });

// User ↔ Evidence
User.hasMany(Evidence, { foreignKey: "UserId" });
Evidence.belongsTo(User, { foreignKey: "UserId" });

// Task ↔ Evidence (many-to-many through TaskEvidence)
Task.belongsToMany(Evidence, { through: TaskEvidence });
Evidence.belongsToMany(Task, { through: TaskEvidence });

// Message ↔ User (sender and receiver)
Message.belongsTo(User, { as: "fromUser", foreignKey: "fromUserId" });
Message.belongsTo(User, { as: "toUser", foreignKey: "toUserId" });

module.exports = {
  sequelize,
  User,
  Task,
  Response,
  Evidence,
  Message,
  TaskEvidence,
};