import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    
    addressType: { type: String, default: "home" },

    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true },

    addressLine1: { type: String, required: true },   // House + Area combined
    addressLine2: { type: String },                   // Landmark / Optional

    city: { type: String, required: true },
    state: { type: String, required: true },

    pincode: { type: String, required: true },
    country: { type: String, required: true, default: "India" },

    isDefault: { type: Boolean, default: false },
}, { _id: true });

const userSchema = new mongoose.Schema({

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, default: "" },
    password: { type: String },
    googleId: { type: String, sparse: true },
    profileImage: { url:{type:String,default:'https://res.cloudinary.com/db5uwjwdv/image/upload/v1763442856/AdobeStock_1185421594_Preview_cvfm1v.jpg'},public_id:{type:String,default:"AdobeStock_1185421594_Preview_cvfm1v"} },
    addresses: [addressSchema],
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
export default User;
