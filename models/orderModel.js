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
    enum: ["pending", "processing", "shipped", "delivered", "cancelled", "returned"],
    default: "pending"
  },

  // Return & Cancel
  cancelReason: String,
  returnReason: String,
  returnDetails: String,

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

  paymentMethod: { type: String, default: "cod" },
  paymentStatus: { type: String, default: "pending" },

  subtotal: Number,
  tax: Number,
  shippingFee: Number,
  totalAmount: Number,

  transactionId: String,
}, 
{ timestamps: true }
);

export default mongoose.model("Order", orderSchema);
