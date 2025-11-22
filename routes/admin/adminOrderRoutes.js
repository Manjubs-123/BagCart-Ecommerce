import express from "express";
import {
  adminListOrders,
  adminGetOrder,
  adminUpdateOrderStatus
} from "../../controllers/admin/adminOrderController.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.js";

const router = express.Router();

router.get("/", isAdminAuthenticated, adminListOrders);          // /admin/orders?search=&status=&page=&sort=
router.get("/:id", isAdminAuthenticated, adminGetOrder);        // detail view
router.patch("/:orderId/item/:itemId/status", isAdminAuthenticated, adminUpdateOrderStatus);
// { status: 'shipped' }

export default router;
