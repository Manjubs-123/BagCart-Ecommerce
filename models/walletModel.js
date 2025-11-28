import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,  // each user has only 1 wallet
    },

    balance: {
      type: Number,
      default: 0,
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
