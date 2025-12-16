import express from "express";
import { createRazorpayOrder, verifyRazorpayPayment, razorpayWebhook ,retryPayment, razorpayInstance  } from "../../controllers/user/paymentController.js";
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


router.get("/order/payment-failed/:orderId", async (req, res) => {
    const orderId = req.params.orderId;

    const order = await Order.findById({_id:orderId})
  
    if(order.paymentStatus === 'paid'){
        console.log('iam the cuprit')
         return res.redirect(`/order/confirmation/${order._id}`);
    }

    const newOrder = await Order.findByIdAndUpdate(
        orderId,
        {
            paymentStatus: "failed",
            orderStatus: "created"
        },
        { new: true }
    );

    if (!newOrder) return res.status(404).send("Order not found");

    
    res.render("user/orderFailure", {
        orderMongoId: newOrder._id,       
        orderDisplayId: newOrder.orderId  
    });
});


router.get("/order/retry/:orderId", retryPayment);

router.post('/:orderId/return-request', returnItem); 
router.post('/:orderId/cancel-item', cancelItem); 


export default router;