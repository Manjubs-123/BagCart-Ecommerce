// middlewares/paymentGuard.js
import Order from "../models/orderModel.js";

export const paymentGuard = async (req, res, next) => {
  const { orderId } = req.params;

  if (!orderId) return next();

  try {
    const order = await Order.findById(orderId).select("paymentStatus");

    if (order && order.paymentStatus === "paid") {
      console.warn(`[PAYMENT_GUARD] Blocked retry for PAID order ${orderId}`);
      return res.redirect(303, `/order/confirmation/${orderId}`);
    }

    next();
  } catch (err) {
    next(err);
  }
};
