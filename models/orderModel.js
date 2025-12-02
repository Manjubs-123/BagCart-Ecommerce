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

  variantIndex: { type: Number, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },

  color: String,
  size: String,
  image: String,

  status: {
    type: String,
    enum: ["pending", "processing",
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "return-requested",
      "return-approved",
      "return-rejected",
      "returned"],
    default: "pending"
  },

  // Return & Cancel
  cancelReason: String,
  cancelDetails: String,
  returnReason: String,
  returnDetails: String,
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
    required: false // Generated in controller 
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
    enum: ["pending", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"],
    default: "pending"
  },

  paymentMethod: { type: String, default: "cod" },
  paymentStatus: { type: String, default: "pending" },

  subtotal: Number,
  tax: Number,
  shippingFee: Number,
  totalAmount: Number,

   // ✅ ADD THIS COUPON FIELD RIGHT HERE
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

export default mongoose.model("Order", orderSchema);
