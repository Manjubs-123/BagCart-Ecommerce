import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({

  name: { 
    type: String, 
    required: true,
    trim: true
  },

  type: { 
    type: String, 
    enum: ["product", "category"], 
    required: true 
  },

  products: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Product" }
  ],

  categories: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Category" }
  ],

  discountValue: { 
    type: Number, 
    required: true,
    min: 5,
    max: 90
  },

  validFrom: { 
    type: Date, 
    required: true 
  },

  validTo: { 
    type: Date, 
    required: true 
  },

  isActive: { 
    type: Boolean, 
    default: true 
  },

}, { timestamps: true });

export default mongoose.model("Offer", offerSchema);
