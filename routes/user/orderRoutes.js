import express from "express";
import {getOrderConfirmation,getMyOrders,
  
  cancelItem,
  returnItem,
  downloadInvoice} from "../../controllers/user/orderController.js";
import { isUserLoggedIn} from "../../middlewares/userAuth.js";
const router = express.Router();

router.get('/orders',isUserLoggedIn,getMyOrders);


// ;
// router.get("/confirmation/:id", isUserLoggedIn, getOrderConfirmation);




// router.get("/:orderId/item/:itemId/invoice", isUserLoggedIn, downloadInvoice);


// router.patch("/:orderId/item/:itemId/cancel", isUserLoggedIn, cancelItem);


// router.patch("/:orderId/item/:itemId/return", returnItem);


// AFTER (using custom orderId):
router.get("/confirmation/:id", getOrderConfirmation); // This already uses custom orderId now
router.get("/:orderId/item/:itemId/invoice", downloadInvoice); // orderId is now custom


router.post("/:orderId/item/:itemId/cancel", cancelItem); // orderId is now custom
router.post("/:orderId/item/:itemId/return", returnItem); // orderId is now custom

// Add this new route if needed:
// router.get("/custom/:orderId", getOrderByCustomId);
 
export default router;