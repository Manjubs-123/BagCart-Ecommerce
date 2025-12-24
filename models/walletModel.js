
import mongoose from "mongoose";
const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0
    },

    transactions: [
      {
        type: {
          type: String,
          enum: ["credit", "debit"],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        description: {
          type: String,
          default: "",
        },
        refId: {
          type: String, 
          default: null
        },
        status: {
          type: String,
          enum: ["success", "reversed"],
          default: "success",
        },
        remarks: {
          type: String,
          default: "",
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);


export default mongoose.model("Wallet", walletSchema);