// controllers/paymentController.js
import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import dotenv from "dotenv";
dotenv.config();


export const razorpayInstance = new Razorpay({
    key_id: process.env.RZP_KEY_ID,
    key_secret: process.env.RZP_KEY_SECRET
});




// Create server-side razorpay order
export const createRazorpayOrder = async (req, res) => {
    try {
        let { orderId, amount } = req.body;

        console.log("Creating Razorpay Order:", { orderId, amount });

        if (!amount) {
            return res.json({ success: false, message: "Amount missing " });
        }

        //  NECESSARY FIX
        const dbOrder = await Order.findById(orderId);
        if (!dbOrder) {
            return res.json({ success: false, message: "Order not found" });
        }

        const rzpOrder = await razorpayInstance.orders.create({
            amount: Math.round(amount * 100),   // convert rupees to paise
            currency: "INR",
            receipt: String(orderId),
        });

        res.json({
            success: true,
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount / 100, // back to rupees
            currency: rzpOrder.currency,
            orderId
        });
    } catch (err) {
        console.log("Razorpay error:", err);
        res.json({ success: false, message: "Failed to create Razorpay order" });
    }
};



export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId, failed, details } = req.body;

    // Fetch order
    const order = await Order.findById(orderId);
    if(!order) return res.status(404).json({ success: false, message: "Order not found" });

    if(failed) {
      // Payment failed — update order
      order.payment.status = "FAILED";
      await order.save();
      return res.json({ success: false, message: "Payment failed" });
    }

    const generated_signature = crypto
      .createHmac('sha256', process.env.RZP_KEY_SECRET)
      .update(razorpayOrderId + "|" + razorpayPaymentId)
      .digest('hex');

    if (generated_signature === razorpaySignature) {
        order.paymentStatus = "paid";
order.razorpayOrderId = razorpayOrderId;
order.razorpayPaymentId = razorpayPaymentId;
order.razorpaySignature = razorpaySignature;

order.orderStatus = "processing"; // or placed
    //   order.payment.status = "PAID";
    //   order.payment.razorpayPaymentId = razorpayPaymentId;
    //   order.payment.razorpaySignature = razorpaySignature;
    //   order.status = "PLACED";
      order.updatedAt = new Date();
      await order.save();
      // You may also reduce stock here (or reduce stock when order created earlier).
      // For safety, decrement stock now using transaction.
      await decrementStockForOrder(order);
      return res.json({ success: true });
    } else {
      order.payment.status = "FAILED";
      await order.save();
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch(err) {
    console.error(err);
    res.status(500).json({ success:false, message: err.message });
  }
};

// helper: decrement stock using transaction
async function decrementStockForOrder(order) {
  const session = await Order.startSession();
  session.startTransaction();
  try {
    for (const item of order.items) {
      const prod = await Product.findById(item.product).session(session);
      if (!prod) throw new Error(`Product ${item.name} not found`);
      if (prod.stock < item.qty) {
        // handle oversell policy — either allow backorder or throw
        throw new Error(`Insufficient stock for ${prod.name}`);
      }
      prod.stock = prod.stock - item.qty;
      await prod.save({ session });
    }
    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    // Depending on policy, you may refund or mark order as holding
    throw err;
  }
}


export const razorpayWebhook = async (req, res) => {
  
  try {
    const webhookSecret = process.env.RZP_WEBHOOK_SECRET;
    const crypto = require('crypto');
    const body = req.body; 
    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    const signature = req.headers['x-razorpay-signature'];

    if (expectedSignature !== signature) {
      return res.status(400).send('Invalid signature');
    }

    const payload = JSON.parse(body.toString());

    // handle events:

    if (payload.event === 'payment.captured') {
      const { payment } = payload.payload;
      const razorpayOrderId = payment.entity.order_id;
      const razorpayPaymentId = payment.entity.id;

      // Find our Order by razorpayOrderId and mark PAID if not already

      const order = await Order.findOne({ "payment.razorpayOrderId": razorpayOrderId });
      if (order && order.payment.status !== "PAID") {
        order.payment.status = "PAID";
        order.payment.razorpayPaymentId = razorpayPaymentId;
        order.status = "PLACED";
        await order.save();
        // decrement stock if not already decremented
      }
    } else if (payload.event === 'payment.failed') {
      // mark order failed
    }
    

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('error');
  }
}; 


export const retryPayment = async (req, res) => {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);

    if (!order) return res.status(404).send("Order not found");

    // ✅ CRITICAL FIX: block retry if already paid
    if (order.paymentStatus === "paid") {
        return res.redirect(`/order/confirmation/${order._id}`);
    }

    // Create fresh Razorpay order ONLY if unpaid
    const rzpOrder = await razorpayInstance.orders.create({
        amount: Math.round(order.totalAmount * 100),
        currency: "INR",
        receipt: orderId
    });

    res.render("user/retryPaymentAuto", {
        orderId: order._id,
        amount: order.totalAmount,
        razorpayOrderId: rzpOrder.id,
        keyId: process.env.RZP_KEY_ID
    });
};


