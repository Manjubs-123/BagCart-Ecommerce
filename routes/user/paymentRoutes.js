import express from "express";
import { createRazorpayOrder, verifyRazorpayPayment, razorpayWebhook ,retryPayment, razorpayInstance, paymentFailedPage  } from "../../controllers/user/paymentController.js";
import { cancelItem,returnItem } from "../../controllers/user/orderController.js";  
import Order from "../../models/orderModel.js";
const router = express.Router();

router.post("/payment/create-order", createRazorpayOrder);
router.post("/verify", verifyRazorpayPayment); 

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook
);


router.get("/order/payment-failed/:orderId",paymentFailedPage);


router.get("/order/retry/:orderId", retryPayment);

router.post('/:orderId/return-request', returnItem); 
router.post('/:orderId/cancel-item', cancelItem); 


export default router;