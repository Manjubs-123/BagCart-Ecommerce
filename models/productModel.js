import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  variants: [
    {
      colour: String,
      price: Number,
      stock: Number,
      images: [String],
    },
  ],
  isBlocked: { type: Boolean, default: false },
  isListed: { type: Boolean, default: true },
});

export default mongoose.model("Product", productSchema);
