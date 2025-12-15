import express from "express";
import { createRazorpayOrder, verifyRazorpayPayment, razorpayWebhook ,retryPayment, razorpayInstance  } from "../../controllers/user/paymentController.js";
import { cancelItem,returnItem } from "../../controllers/user/orderController.js";  
import Order from "../../models/orderModel.js";
const router = express.Router();

router.post("/payment/create-order", createRazorpayOrder);
router.post("/verify", verifyRazorpayPayment); // called from client after checkout
// router.post("/webhook", razorpayWebhook); // recommended
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook
);

// router.get("/order/payment-failed/:orderId", async (req, res) => {
//     const orderId = req.params.orderId;

//     await Order.findByIdAndUpdate(orderId, {
//         paymentStatus: "failed",
//         orderStatus: "created"
//     });

//       res.render("user/orderFailure", {  // <-- FIXED HERE
//         orderId
//     });
// });

router.get("/order/payment-failed/:orderId", async (req, res) => {
    const orderId = req.params.orderId;

    // ✅ Fetch order — required to get display ID
    

    const order = await Order.findById({_id:orderId})
    // console.log(order)
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

    // ✅ Send both values with SAME names used in EJS
    res.render("user/orderFailure", {
        orderMongoId: newOrder._id,       // used for retry button route
        orderDisplayId: newOrder.orderId  // shown to user
    });
});


router.get("/order/retry/:orderId", retryPayment);


router.get("/order/retry/:orderId", retryPayment);


router.post('/:orderId/return-request', returnItem); // user
router.post('/:orderId/cancel-item', cancelItem); // user



export default router;