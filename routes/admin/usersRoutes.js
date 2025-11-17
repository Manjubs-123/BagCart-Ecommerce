import express from "express";
import { getUsers, toggleBlockUser } from "../../controllers/admin/userController.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.js";

const router = express.Router();


router.get("/", isAdminAuthenticated, getUsers);
router.put("/toggle-block/:id", isAdminAuthenticated, toggleBlockUser);

export default router;
