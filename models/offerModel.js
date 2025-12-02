import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  name: { type: String, required: true },

  offerType: {
    type: String,
    enum: ["PRODUCT", "CATEGORY"],
    required: true
  },

  products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

  discountType: { type: String, enum: ["PERCENTAGE", "FIXED"], default: "PERCENTAGE" },
  discountValue: { type: Number, required: true },
  maxDiscountAmount: Number,

  validFrom: { type: Date, required: true },
  validTo: { type: Date, required: true },

  isActive: { type: Boolean, default: true },

}, { timestamps: true });

export default mongoose.model("Offer", offerSchema);
