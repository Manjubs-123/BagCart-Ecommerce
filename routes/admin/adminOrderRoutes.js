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
// /admin/orders?search=&status=&page=&sort=
router.get("/:id", isAdminAuthenticated, adminGetOrder); 
       // detail view
router.patch("/:orderId/item/:itemId/status", isAdminAuthenticated, adminUpdateOrderStatus);
// { status: 'shipped' }
router.post("/returns/:orderId/item/:itemId/approve", approveReturn);
router.post("/returns/:orderId/item/:itemId/reject", rejectReturn);




export default router;
