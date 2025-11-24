import express from "express";
import {getOrderConfirmation,getMyOrders,
  
  cancelItem,
  returnItem,
  downloadInvoice } from "../../controllers/user/orderController.js";
import { isUserLoggedIn} from "../../middlewares/userAuth.js";
const router = express.Router();

router.get('/orders',isUserLoggedIn,getMyOrders);


;
router.get("/confirmation/:id", isUserLoggedIn, getOrderConfirmation);




router.get("/:orderId/item/:itemId/invoice", isUserLoggedIn, downloadInvoice);


router.patch("/:orderId/item/:itemId/cancel", isUserLoggedIn, cancelItem);


router.patch("/:orderId/item/:itemId/return", returnItem);
 
export default router;