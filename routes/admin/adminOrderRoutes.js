import express from "express";
import {
  adminListOrders,
  adminGetOrder,
  adminUpdateOrderStatus,
  adminGetCancelledItems,
  getReturnRequests,
  approveReturn,
  rejectReturn
} from "../../controllers/admin/adminOrderController.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.js";

const router = express.Router();

router.get("/", isAdminAuthenticated, adminListOrders);  

router.get("/returns", isAdminAuthenticated, getReturnRequests);
router.get("/cancelled/:id", adminGetCancelledItems);

router.get("/:id", isAdminAuthenticated, adminGetOrder); 
       
router.patch("/:orderId/item/:itemId/status", isAdminAuthenticated, adminUpdateOrderStatus);

router.post("/returns/:orderId/item/:itemId/approve", isAdminAuthenticated, approveReturn);
router.post("/returns/:orderId/item/:itemId/reject", isAdminAuthenticated, rejectReturn);




export default router;
