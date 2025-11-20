const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      variantIndex: Number,
      quantity: Number,
      price: Number
    }
  ],
  address: {},
  paymentMethod: String,
  totalAmount: Number,
  status: { type: String, default: "Pending" }
}, { timestamps: true });
