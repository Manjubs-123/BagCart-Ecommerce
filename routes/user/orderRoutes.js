import express from "express";
import {getOrderConfirmation,getMyOrders,
  
  cancelItem,
  returnItem,
  downloadInvoice} from "../../controllers/user/orderController.js";
import { isUserLoggedIn} from "../../middlewares/userAuth.js";
const router = express.Router();

router.get('/orders',isUserLoggedIn,getMyOrders);

router.get("/confirmation/:id", getOrderConfirmation); 
router.get("/:orderId/item/:itemId/invoice", downloadInvoice); 


router.post("/:orderId/item/:itemId/cancel", cancelItem); 
router.post("/:orderId/item/:itemId/return", returnItem); 

 
export default router;