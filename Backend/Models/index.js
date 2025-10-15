const sequelize = require("../Data/database");
const User = require("./User");
const Evidence = require("./Evidence");
const Message = require("./Message");
const CustomerProfile = require("./CustomerProfile");

// User → Evidence (owner/creator)
User.hasMany(Evidence, { foreignKey: "UserId" });
Evidence.belongsTo(User, { foreignKey: "UserId" });

// Message → User (sender and receiver)
Message.belongsTo(User, { as: "fromUser", foreignKey: "fromUserId" });
Message.belongsTo(User, { as: "toUser", foreignKey: "toUserId" });

// Customer profile ↔ User
User.hasOne(CustomerProfile, { foreignKey: "UserId", as: "customerProfile", onDelete: "CASCADE" });
CustomerProfile.belongsTo(User, { foreignKey: "UserId", as: "user" });

module.exports = {
  sequelize,
  User,
  Evidence,
  Message,
  CustomerProfile,
};