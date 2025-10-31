// routes/admin/userRoutes.js
import express from "express";
import { getUsers, toggleBlockUser } from "../../controllers/admin/userController.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.js";

const router = express.Router();

// Show all users
router.get("/", isAdminAuthenticated, getUsers);

// Block or unblock a user
router.post("/toggle-block/:id", isAdminAuthenticated, toggleBlockUser);

export default router;
