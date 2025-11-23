import express from "express";
import {getOrderConfirmation,getMyOrders,
  
  cancelItem,
  returnItem,
  downloadInvoice } from "../../controllers/user/orderController.js";
import { isUserLoggedIn} from "../../middlewares/userAuth.js";
const router = express.Router();

router.get('/orders',isUserLoggedIn,getMyOrders);
// router.get('/order/:orderId/item/:itemId',isUserLoggedIn,getOrderDetails);

// router.post("/api/orders", isUserLoggedIn, placeOrder);
router.get("/confirmation/:id", isUserLoggedIn, getOrderConfirmation);
// router.get("/details/:id", isUserLoggedIn, getOrderDetails);


// invoice (download)
router.get("/:orderId/item/:itemId/invoice", isUserLoggedIn, downloadInvoice);

// cancel / return
router.patch("/:orderId/item/:itemId/cancel", isUserLoggedIn, cancelItem);

// router.patch("/order/:orderId/item/:itemId/return", isUserLoggedIn, returnItem);
router.patch("/:orderId/item/:itemId/return", returnItem);
 
export default router;