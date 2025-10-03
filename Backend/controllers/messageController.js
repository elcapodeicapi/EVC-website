const { Message, User } = require("../Models");
const { Op } = require("sequelize");


// GET all messages for the logged-in user (forum-like)
exports.getAllMessages = async (req, res) => {
  try {
    const userId = req.user.id;

    // If admin → see all, else only see your conversations
    if (req.user.role === "admin") {
      // Admins can see all messages
      whereClause = {};
    } else {
      // Regular user: only see conversation with admins
      whereClause = {
        [Op.or]: [
          { fromUserId: req.user.id },
          { toUserId: req.user.id }
        ]
      };
    }

    const msgs = await Message.findAll({
      where: whereClause,
      include: [
        { model: User, as: "fromUser", attributes: ["id", "name", "email"] },
        { model: User, as: "toUser", attributes: ["id", "name", "email"] }
      ],
      order: [["createdAt", "ASC"]]
    });

    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST send message
exports.sendMessage = async (req, res) => {
  try {
    const { toUserId, content } = req.body;
    const fromUserId = req.user.id;

    // ensure content
    if (!content) return res.status(400).json({ error: "Message is empty" });

    // prevent non-admins from messaging other non-admins
    if (req.user.role !== "admin") {
      const recipient = await User.findByPk(toUserId);
      if (!recipient || recipient.role !== "admin") {
        return res.status(403).json({ error: "You can only message admins" });
      }
    }

    const msg = await Message.create({ fromUserId, toUserId, content });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
