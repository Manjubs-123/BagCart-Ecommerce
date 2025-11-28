import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      uppercase: true,
    },

    // only percentage
    discountType: {
      type: String,
      enum: ["PERCENTAGE"],
      default: "PERCENTAGE",
      required: true,
    },

    // 1–100% percentage
    discountValue: {
      type: Number,
      required: true,
      min: 1,
      max: 90,
    },

    maxDiscountAmount: {
      type: Number,
      required: true,
      min: 5,
    },

    minOrderAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    validFrom: {
      type: Date,
      required: true,
    },

    validTo: {
      type: Date,
      required: true,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    maxUsage: {
      type: Number,
      min: 1,
      default: null,
    },

    maxUsagePerUser: {
      type: Number,
      min: 1,
      default: null,
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);
couponSchema.pre("save", function (next) {
  if (this.discountValue > 90) {
    this.discountValue = 90;
  }
  if (this.discountValue < 5 && this.discountValue >= 1) {
    this.discountValue = 5;
  }
  next();
});

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
