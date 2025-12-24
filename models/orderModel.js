
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  itemOrderId: {
    type: String,
    required: false, 
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },


  variantIndex: { type: Number, required: true, min: 0 },

 
  quantity: { type: Number, required: true, min: 1 },

  
  price: { type: Number, required: true, min: 0 },
    regularPrice: { type: Number },

  color: String,
  size: String,
  image: String,

  // These store HOW MUCH of each cost belongs to THIS item
  itemSubtotal: { type: Number, default: 0 }, // price × quantity
  itemCouponShare: { type: Number, default: 0 }, // This item's coupon discount
  itemAfterCoupon: { type: Number, default: 0 }, // itemSubtotal - itemCouponShare
  itemTaxShare: { type: Number, default: 0 }, // This item's tax
  itemShippingShare: { type: Number, default: 0 }, // This item's shipping
  itemFinalPayable: { type: Number, default: 0 }, // What user ACTUALLY paid for this item


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

  refundAmount: { type: Number, default: 0 },
  refundMethod: { type: String, enum: ["wallet", "razorpay", "none"], default: "none" },
  refundStatus: { type: String, enum: ["none", "pending", "credited"], default: "none" },
  refundDate: Date,

  cancelReason: String,
  cancelDetails: String,
  
  cancelledQty: { type: Number, default: 0, min: 0 },

  returnReason: String,
  returnDetails: String,
  
  returnedQty: { type: Number, default: 0, min: 0 },

  returnRequestedDate: Date,
  returnApprovedDate: Date,
  returnRejectedDate: Date,


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



const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: false 
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


  paymentMethod: { type: String, enum: ["cod", "razorpay", "wallet"], default: "cod" },

  
  paymentStatus: { type: String, enum: ["pending", "paid", "failed", "partial_refunded","refunded"], default: "pending" },

 
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,

  
  paymentFailureReason: String,


  refundStatus: { type: String, enum: ["none", "requested", "processed"], default: "none" },

 
  subtotal: { type: Number, default: 0, min: 0 },
  offerDiscount: { type: Number, default: 0 },
  tax: { type: Number, default: 0, min: 0 },
  shippingFee: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, default: 0, min: 0 },

  
  coupon: {
    code: String,
    discountValue: Number, 
    discountAmount: Number, 
      

    maxDiscountAmount: Number,
    subtotalBeforeCoupon: Number 
  },



  transactionId: String,
},
  { timestamps: true }
);


orderSchema.index({ user: 1 });
orderSchema.index({ orderId: 1 }); 
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
