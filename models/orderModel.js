import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    variantIndex: {
        type: Number,
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: 1
    },

    price: {
        type: Number,
        required: true
    },

    color: { type: String },

    // snapshot of product image
    image: { type: String }
});

const orderSchema = new mongoose.Schema(
{
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // snapshot of address
    shippingAddress: {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        addressLine1: { type: String, required: true },
        addressLine2: { type: String, default: "" },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, default: "India" }
    },

    items: [orderItemSchema],

    paymentMethod: {
        type: String,
        enum: ["cod", "wallet"],
        default: "cod"
    },

    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending"
    },

    orderStatus: {
        type: String,
        enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
        default: "pending"
    },

    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    totalAmount: { type: Number, required: true },

    // tracking ID, razorpay id if added later
    transactionId: { type: String }
},
{ timestamps: true }
);

export default mongoose.model("Order", orderSchema);
