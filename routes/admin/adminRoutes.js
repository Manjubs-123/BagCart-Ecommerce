import express from "express";
import {renderAdminLogin,postAdminLogin,renderAdminDashboard,adminLogout} from "../../controllers/admin/adminController.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.js";

const router=express.Router();

router.get("/",isAdminAuthenticated,renderAdminLogin);
router.post("/login",isAdminAuthenticated,postAdminLogin);
router.get("/dashboard",isAdminAuthenticated,renderAdminDashboard);
router.get("/logout",isAdminAuthenticated,adminLogout);

export default router;
