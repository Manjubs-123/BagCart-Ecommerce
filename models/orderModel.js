
import mongoose from "mongoose";

// Individual item schema
const orderItemSchema = new mongoose.Schema({
  itemOrderId: {
    type: String,
    required: false, // generated later
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  // ensure variantIndex can't be negative
  variantIndex: { type: Number, required: true, min: 0 },

  // quantity must be >= 1
  quantity: { type: Number, required: true, min: 1 },

  // price snapshot at time of order
  price: { type: Number, required: true, min: 0 },

  color: String,
  size: String,
  image: String,

  status: {
    type: String,
    enum: [
      "pending",
      "processing",
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "return-requested",
      "return-approved",
      "return-rejected",
      "returned"
    ],
    default: "pending"
  },

  // Return & Cancel
  cancelReason: String,
  cancelDetails: String,
  // track how many were cancelled for partial cancels
  cancelledQty: { type: Number, default: 0, min: 0 },

  returnReason: String,
  returnDetails: String,
  // track how many were returned for partial returns
  returnedQty: { type: Number, default: 0, min: 0 },

  returnRequestedDate: Date,
  returnApprovedDate: Date,
  returnRejectedDate: Date,

  // Timeline tracking
  shippedDetails: {
    courier: String,
    trackingId: String,
    expectedDate: Date
  },

  estimatedDelivery: Date,
  deliveredDate: Date,
  cancelledDate: Date,
  returnedDate: Date
});


// Main order schema
const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: false // Generated in controller; keep false so old docs don't break
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  shippingAddress: {
    fullName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: "India" },
  },

  items: [orderItemSchema],

  orderStatus: {
    type: String,
    enum: ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"],
    default: "pending"
  },

  // make paymentMethod an enum so only known values are used
  paymentMethod: { type: String, enum: ["cod", "razorpay", "wallet"], default: "cod" },

  // better to enforce a set of statuses for payment
  paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },

  // Razorpay fields (REQUIRED)
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,

  // optionally store a short failure reason for debugging
  paymentFailureReason: String,

  // small helper: refund status for the order (none/requested/processed)
  refundStatus: { type: String, enum: ["none", "requested", "processed"], default: "none" },

  // numeric fields with defaults to prevent undefined in calculations
  subtotal: { type: Number, default: 0, min: 0 },
  offerDiscount: { type: Number, default: 0 },
  tax: { type: Number, default: 0, min: 0 },
  shippingFee: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, default: 0, min: 0 },

  // coupon info (unchanged, kept for compatibility)
  coupon: {
    code: String,
    discountValue: Number,  // percentage like 10, 20, etc
    discountAmount: Number, // actual discount applied in rupees
      

    maxDiscountAmount: Number,
    subtotalBeforeCoupon: Number 
  },



  transactionId: String,
},
  { timestamps: true }
);

// Indexes for common queries - non-breaking and improves performance
orderSchema.index({ user: 1 });
orderSchema.index({ orderId: 1 }); // if you later make orderId unique, change here
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
