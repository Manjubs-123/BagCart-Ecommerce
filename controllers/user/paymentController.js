
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


export const paymentFailedPage = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).send("Order not found");
    }

    // If payment already marked as paid, redirect to confirmation
    if (order.paymentStatus === "paid") {
      console.log("Payment already successful, redirecting...");
      return res.redirect(`/order/confirmation/${order._id}`);
    }

    // Update payment as failed
    order.paymentStatus = "failed";
    order.orderStatus = "created";
    await order.save();

    return res.render("user/orderFailure", {
      orderMongoId: order._id,
      orderDisplayId: order.orderId,
    });
  } catch (error) {
    console.error("Payment failed page error:", error);
    res.status(500).send("Internal Server Error");
  }
};




export const createRazorpayOrder = async (req, res) => {
  try {
    let { orderId, amount } = req.body;

    console.log("Creating Razorpay Order:", { orderId, amount });

    if (!amount) {
      return res.json({ success: false, message: "Amount missing " });
    }


    const dbOrder = await Order.findById(orderId);
    if (!dbOrder) {
      return res.json({ success: false, message: "Order not found" });
    }

    const rzpOrder = await razorpayInstance.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: String(orderId),
    });

    res.json({
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount / 100,
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
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      orderId,
      failed
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    /* -----------------------------
       PAYMENT FAILED (FROM CLIENT)
    ----------------------------- */
    if (failed) {
      order.paymentStatus = "failed";
      order.orderStatus = "created";
      await order.save();

      return res.json({
        success: false,
        redirectUrl: `/order/payment-failed/${order._id}`
      });
    }

    /* -----------------------------
       VERIFY SIGNATURE
    ----------------------------- */
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RZP_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      order.paymentStatus = "failed";
      order.orderStatus = "created";
      await order.save();

      return res.status(400).json({
        success: false,
        redirectUrl: `/order/payment-failed/${order._id}`,
        message: "Invalid payment signature"
      });
    }

    /* -----------------------------
       PAYMENT SUCCESS
    ----------------------------- */
    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.razorpayOrderId = razorpayOrderId;
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    order.updatedAt = new Date();

    await order.save();

    // Reduce stock ONLY AFTER payment success
    await decrementStockForOrder(order);

    return res.json({
      success: true,
      redirectUrl: `/order/confirmation/${order._id}`
    });

  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed"
    });
  }
};


// helper: decrement stock using transaction
// async function decrementStockForOrder(order) {
//   const session = await Order.startSession();
//   session.startTransaction();
//   try {
//     for (const item of order.items) {
//       const prod = await Product.findById(item.product).session(session);
//       if (!prod) throw new Error(`Product ${item.name} not found`);
//       if (prod.stock < item.qty) {
//         throw new Error(`Insufficient stock for ${prod.name}`);
//       }
//       prod.stock = prod.stock - item.qty;
//       await prod.save({ session });
//     }
//     await session.commitTransaction();
//     session.endSession();
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     throw err;
//   }
// }

async function decrementStockForOrder(order) {
  const session = await Product.startSession();
  session.startTransaction();

  try {
    for (const item of order.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) continue;

      const variant = product.variants[item.variantIndex];
      if (!variant) continue;

      if (variant.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      variant.stock -= item.quantity;
      if (variant.stock < 0) variant.stock = 0;

      product.markModified(`variants.${item.variantIndex}.stock`);
      await product.save({ session });
    }

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
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


    if (payload.event === 'payment.captured') {
      const { payment } = payload.payload;
      const razorpayOrderId = payment.entity.order_id;
      const razorpayPaymentId = payment.entity.id;


      const order = await Order.findOne({ "payment.razorpayOrderId": razorpayOrderId });
      if (order && order.paymentStatus === 'paid') {
        order.paymentStatus = 'paid';
        order.payment.razorpayPaymentId = razorpayPaymentId;
        order.status = "PLACED";
        await order.save();
      }
    } else if (payload.event === 'payment.failed') {

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

  if (order.paymentStatus === "paid") {
    return res.redirect(`/order/confirmation/${order._id}`);
  }

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


