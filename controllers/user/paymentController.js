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

export const createRazorpayOrder = async (req, res) => {
  try {
    let { orderId, amount } = req.body;

    console.log("🔥 Creating Razorpay Order:", { orderId, amount });

    if (!amount) {
      return res.json({ success: false, message: "Amount missing" });
    }

    const dbOrder = await Order.findById(orderId);
    if (!dbOrder) {
      return res.json({ success: false, message: "Order not found" });
    }

    // 🔥 CRITICAL FIX: Use order's totalAmount, not frontend amount
    // This ensures consistency even if frontend has stale data
    const orderAmount = dbOrder.totalAmount;
    
    console.log("✅ Amount verification:", {
      frontendAmount: amount,
      databaseAmount: orderAmount,
      match: Math.abs(amount - orderAmount) < 0.01
    });

    // 🔥 SECURITY: Validate amounts match (allow 1 paisa difference for rounding)
    if (Math.abs(amount - orderAmount) > 0.01) {
      console.error("❌ Amount mismatch detected!");
      return res.status(400).json({
        success: false,
        message: "Amount mismatch. Please refresh and try again.",
        expected: orderAmount,
        received: amount
      });
    }

    // Use database amount (source of truth)
    const rzpOrder = await razorpayInstance.orders.create({
      amount: Math.round(orderAmount * 100), // Convert to paise
      currency: "INR",
      receipt: String(orderId),
      notes: {
        orderId: dbOrder.orderId,
        userId: dbOrder.user.toString()
      }
    });

    console.log("✅ Razorpay order created:", rzpOrder.id);

    res.json({
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount / 100, // Convert back to rupees
      currency: rzpOrder.currency,
      orderId,
      // 🔥 NEW: Send breakdown for UI display
      breakdown: {
        subtotal: dbOrder.subtotal,
        couponDiscount: dbOrder.coupon?.discountAmount || 0,
        tax: dbOrder.tax,
        shipping: dbOrder.shippingFee,
        total: dbOrder.totalAmount
      }
    });
  } catch (err) {
    console.error("❌ Razorpay error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create Razorpay order",
      error: err.message 
    });
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

    console.log("🔥 Verifying payment:", { orderId, razorpayPaymentId, failed });

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
      order.paymentFailureReason = "User cancelled or payment failed";
      await order.save();

      console.log("❌ Payment marked as failed");

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
      console.error("❌ Invalid signature!");
      
      order.paymentStatus = "failed";
      order.orderStatus = "created";
      order.paymentFailureReason = "Invalid payment signature";
      await order.save();

      return res.status(400).json({
        success: false,
        redirectUrl: `/order/payment-failed/${order._id}`,
        message: "Invalid payment signature"
      });
    }

    /* -----------------------------
       🔥 PAYMENT SUCCESS - WITH STOCK VALIDATION
    ----------------------------- */
    console.log("✅ Payment signature verified");

    // 🔥 CRITICAL: Validate stock BEFORE marking as paid
    try {
      await decrementStockForOrder(order);
    } catch (stockError) {
      console.error("❌ Stock deduction failed:", stockError.message);
      
      // Don't mark as failed - initiate refund instead
      order.paymentStatus = "paid"; // Payment was successful
      order.orderStatus = "cancelled"; // But order is cancelled due to stock
      order.refundStatus = "requested";
      order.paymentFailureReason = "Stock unavailable - refund initiated";
      await order.save();

      return res.status(409).json({
        success: false,
        message: "Stock no longer available. Refund will be processed within 5-7 business days.",
        redirectUrl: `/order/payment-failed/${order._id}`,
        refundInitiated: true
      });
    }

    // Stock deducted successfully - complete order
    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.razorpayOrderId = razorpayOrderId;
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    order.updatedAt = new Date();

    await order.save();

    console.log("✅ Order completed successfully:", order.orderId);

    return res.json({
      success: true,
      redirectUrl: `/order/confirmation/${order._id}`
    });

  } catch (err) {
    console.error("❌ VERIFY PAYMENT ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed. Please contact support."
    });
  }
};

async function decrementStockForOrder(order) {
  const session = await Product.startSession();
  session.startTransaction();

  try {
    for (const item of order.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) {
        throw new Error(`Product not found: ${item.product}`);
      }

      const variant = product.variants[item.variantIndex];
      if (!variant) {
        throw new Error(`Variant not found for ${product.name}`);
      }

      // 🔥 CRITICAL: Final stock check
      if (variant.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${variant.stock}, Required: ${item.quantity}`
        );
      }

      variant.stock -= item.quantity;
      if (variant.stock < 0) variant.stock = 0;

      product.markModified(`variants.${item.variantIndex}.stock`);
      await product.save({ session });
      
      console.log(`✅ Stock reduced for ${product.name}: ${variant.stock + item.quantity} → ${variant.stock}`);
    }

    await session.commitTransaction();
    session.endSession();
    console.log("✅ All stock updates committed");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Stock deduction failed, transaction rolled back");
    throw err;
  }
}

export const paymentFailedPage = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).send("Invalid order id");
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).send("Order not found");
    }

    // If already paid, redirect to confirmation
    if (order.paymentStatus === "paid") {
      return res.redirect(`/order/confirmation/${order._id}`);
    }

    // Update payment status only if not already failed
    if (order.paymentStatus !== "failed") {
      order.paymentStatus = "failed";
      await order.save();
    }

    return res.render("user/orderFailure", {
      orderMongoId: order._id,
      orderDisplayId: order.orderId,
      totalAmount: order.totalAmount,
      refundInitiated: order.refundStatus === "requested"
    });

  } catch (error) {
    console.error("Payment failed page error:", error);
    return res.status(500).send("Internal Server Error");
  }
};

export const retryPayment = async (req, res) => {
  const orderId = req.params.orderId;
  const order = await Order.findById(orderId);

  if (!order) return res.status(404).send("Order not found");

  if (order.paymentStatus === "paid") {
    return res.redirect(`/order/confirmation/${order._id}`);
  }

  // 🔥 FIX: Recalculate and verify order amount
  const expectedAmount = order.totalAmount;
  
  console.log("🔥 Retry payment:", {
    orderId: order._id,
    orderDisplayId: order.orderId,
    amount: expectedAmount
  });

  const rzpOrder = await razorpayInstance.orders.create({
    amount: Math.round(expectedAmount * 100),
    currency: "INR",
    receipt: orderId
  });

  res.render("user/retryPaymentAuto", {
    orderId: order._id,
    amount: expectedAmount, // Use database amount
    razorpayOrderId: rzpOrder.id,
    keyId: process.env.RZP_KEY_ID,
    breakdown: {
      subtotal: order.subtotal,
      couponDiscount: order.coupon?.discountAmount || 0,
      tax: order.tax,
      shipping: order.shippingFee,
      total: order.totalAmount
    }
  });
};

// ... rest of your functions