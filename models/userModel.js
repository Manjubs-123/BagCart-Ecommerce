import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    pincode: { type: String, required: true },
    house: { type: String, required: true },
    area: { type: String, required: true },
    landmark: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
}, { _id: true });
const userSchema = new mongoose.Schema({

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, default: "" },
    password: { type: String },
    googleId: { type: String, sparse: true },
    profileImage: { type: String, default: "" },
    addresses: [addressSchema],
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
export default User;
