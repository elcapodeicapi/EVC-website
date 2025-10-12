const express = require("express");
const router = express.Router();
const customerProfileController = require("../controllers/customerProfileController");
const trajectController = require("../controllers/trajectController");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");

router.use(authenticate);
router.use(authorizeRoles("customer"));

router.get("/profile", customerProfileController.getProfile);
router.put("/profile", customerProfileController.updateProfile);
router.get("/planning", trajectController.getCustomerPlanning);

module.exports = router;
