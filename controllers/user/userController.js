
import dotenv from "dotenv";
dotenv.config();
import { sendOtpMail } from "../../utils/sendMail.js";
import User from "../../models/userModel.js";
import bcrypt from "bcryptjs";
import cloudinary from "../../config/cloudinary.js";
import fs from "fs";
import mongoose from "mongoose";
import {loadHomeProducts,renderLandingPage} from "./productController.js"; 
import Order from "../../models/orderModel.js";
import { applyOfferToProduct } from "../../utils/applyOffer.js"; 



export const getSignup = (req, res) => {
  res.render("user/signup", { error: null });
};


export const signupUser = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error("DB not connected - readyState:", mongoose.connection.readyState);
      return res.status(503).render("user/signup", {
        error: "Service temporarily unavailable. Please try again later.",
      });
    }

    const { name, email, password, confirmPassword } = req.body;

 
    if (!name?.trim()) return res.render("user/signup", { error: "Name is required." });
    if (name.trim().length < 6) return res.render("user/signup", { error: "Name must be at least 6 characters." });
    if (!/^[a-zA-Z\s]+$/.test(name)) return res.render("user/signup", { error: "Name can contain only alphabets." });

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailRegex.test(email)) {
  return res.render("user/signup", { error: "Enter a valid email address." });
}

    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.render("user/signup", {
        error: "Password must have 1 uppercase, 1 number, 1 special char, and be ≥6 chars long.",
      });
    }
    if (password !== confirmPassword) {
      return res.render("user/signup", { error: "Passwords do not match." });
    }

    //  Check existing user 
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isVerified) {
      return res.render("user/signup", { error: "Email already registered. Please login." });
    } else if (existingUser && !existingUser.isVerified) {
      await User.deleteOne({ _id: existingUser._id });
    }

    //  Create new user 
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
    });
    await newUser.save();

    //  Generate OTP and store in session 
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.otp = otp;
    req.session.email = email;
    req.session.otpExpires = Date.now() + 1 * 60 * 1000; 
    req.session.pendingEmail = email;

    //  Send OTP via email 
    await sendOtpMail(email, otp); 

    console.log(`OTP sent to ${email}: ${otp}`);
    
    res.redirect("/user/verifyOtp");
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).render("user/signup", { error: "Something went wrong. Please try again later." });
  }
};


export const getVerifyOtp = (req, res) => {
  const email = req.session.pendingEmail;

  if (!email) return res.redirect("/user/signup");

  const RESEND_COOLDOWN = 60;
  const OTP_EXPIRY_MINUTES = 1;
  const cooldown = req.session.cooldown || 0;

  res.render("user/verifyOtp", {
    email,
    error: null,
    cooldown,
    RESEND_COOLDOWN,     
    OTP_EXPIRY_MINUTES,  
  });
};

export const postVerifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const { otp: storedOtp, otpExpires, pendingEmail } = req.session;
    const email = pendingEmail;

    
    if (!storedOtp || Date.now() > otpExpires) {
      return res.render("user/verifyOtp", { 
        email, 
        error: "OTP expired. Please sign up again.",
        cooldown: 0,
        RESEND_COOLDOWN: 60,
        OTP_EXPIRY_MINUTES: 1
      });
    }

    
    if (otp !== storedOtp) {
      return res.render("user/verifyOtp", { 
        email, 
        error: "Invalid OTP. Please try again.",
        cooldown: 0,
        RESEND_COOLDOWN: 60,
        OTP_EXPIRY_MINUTES: 1
      });
    }

   
    const user = await User.findOne({ email });
    if (!user)
      return res.render("user/signup", { error: "User not found. Please sign up again." });

    user.isVerified = true;

    const DEFAULT_URL = "https://res.cloudinary.com/db5uwjwdv/image/upload/v1763442856/AdobeStock_1185421594_Preview_cvfm1v.jpg";
    const DEFAULT_ID = "AdobeStock_1185421594_Preview_cvfm1v";

    if (!user.profileImage || !user.profileImage.url) {
      user.profileImage = {
        url: DEFAULT_URL,
        public_id: DEFAULT_ID
      };
    }

    await user.save();
//Intialize user session
    req.session.isLoggedIn = true;
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      wishlistCount: user.wishlist?.length || 0,
      cartCount: user.cart?.items?.length || 0
    };

//clear otp session data 
    delete req.session.otp;
    delete req.session.otpExpires;
    delete req.session.pendingEmail;
    delete req.session.cooldown;

    return res.redirect("/user/home");

  } catch (err) {
    console.error("OTP Verification Error:", err);
    return res.status(500).render("user/verifyOtp", {
      email: req.session.pendingEmail || "",
      error: "Something went wrong.",
      cooldown: 0,
      RESEND_COOLDOWN: 60,
      OTP_EXPIRY_MINUTES: 1
    });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const email = req.session.pendingEmail;
    if (!email) return res.redirect("/user/signup");

    const now = Date.now();
    const cooldown = req.session.cooldown || 0;

    if (now < cooldown) {
      const remaining = Math.ceil((cooldown - now) / 1000);
      return res.render("user/verifyOtp", {
        email,
        error: `Please wait ${remaining}s before resending OTP.`,
        cooldown: remaining,
        RESEND_COOLDOWN: 60,
        OTP_EXPIRY_MINUTES: 1,
      });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.otp = newOtp;
    req.session.otpExpires = now + 1 * 60 * 1000;
    req.session.cooldown = now + 60 * 1000;

    await sendOtpMail(email, newOtp);
    console.log(`Resent Signup OTP to ${email}: ${newOtp}`);


    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.render("user/verifyOtp", {
          email,
          error: "Failed to update session. Try again.",
          cooldown: 0,
          RESEND_COOLDOWN: 60,
          OTP_EXPIRY_MINUTES: 1,
        });
      }

      return res.render("user/verifyOtp", {
        email,
        error: null,
        cooldown: 60,
        RESEND_COOLDOWN: 60,
        OTP_EXPIRY_MINUTES: 1,
      });
    });

  } catch (err) {
    console.error("Resend OTP Error:", err);
    res.render("user/verifyOtp", {
      email: req.session.pendingEmail || "",
      error: "Failed to resend OTP. Please try again.",
      cooldown: 0,
      RESEND_COOLDOWN: 60,
      OTP_EXPIRY_MINUTES: 1,
    });
  }
};



export const getLogin = (req, res) => {
  const blocked = req.query.blocked === "true";
  let error = null;

  if (blocked) {
    error = "Your account has been blocked by the admin.";
  }

  res.render("user/login", { error });
};



export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.render("user/login", { error: "No account found with this email." });
    if (user.isBlocked) return res.render("user/login", { error: "Your account has been blocked by admin." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.render("user/login", { error: "Invalid email or password." });

    req.session.isLoggedIn = true;//mark user as logged in 
    req.session.user = { id: user._id, name: user.name, email: user.email,profileImage:user.profileImage,wishlistCount:user.wishlist?.length||0, cartCount: user.cart?.items?.length || 0 };

    res.redirect("/user/landing");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).render("user/login", { error: "Something went wrong. Please try again." });
  }
};


export const showHomePage = async (req, res) => {
  return renderLandingPage(req, res);
};


export const renderUserProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findById(userId).lean();

    res.render("user/profile", {
      title: "Profile",
      user,
      orders: [],
      wishlist: [],
      ordersCount: 0,
      wishlistCount: 0,
      unreadNotifications: 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};



export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findById(userId);

    const { name, phone } = req.body;
    const DEFAULT_AVATAR_ID = "AdobeStock_1185421594_Preview_cvfm1v";


    let isUpdated = false; 

   
    if (name && name !== user.name) {
      user.name = name;
      isUpdated = true;
    }

   
    if (phone !== user.phone) {
      user.phone = phone;
      isUpdated = true;
    }


   
    if (req.file) {
      if (user.profileImage?.public_id&& user.profileImage.public_id!==DEFAULT_AVATAR_ID) {
        await cloudinary.uploader.destroy(user.profileImage.public_id);
      }
//upload new img 
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "profiles",
      });

      user.profileImage = {
        url: result.secure_url,
        public_id: result.public_id,
      };

      fs.unlinkSync(req.file.path);
      isUpdated = true;
    }

     
    if (!isUpdated) {
      return res.json({
        success: false,
        message: "No changes detected"
      });
    }


    await user.save();
    req.session.user.name = user.name;
    req.session.user.phone = user.phone;
    req.session.user.profileImage = user.profileImage;
    return res.json({ success: true });

  } catch (err) {
    console.log("PROFILE UPDATE ERROR:", err);
    return res.json({ success: false, message: "Server Error" });
  }
};


export const getChangeEmailPage = (req, res) => {
  const user=req.user;
  if(!user) return res.redirect("/user/login")
    if(user.googleId){
          return res.redirect("/user/profile?error=email_change_not_allowed");

    }
  res.render("user/profileEmailChange", { user });
};




export const sendChangeEmailOtp = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { newEmail } = req.body;

    if (!newEmail) {
      return res.json({ success: false, message: "Email is required" });
    }

    const user = await User.findById(userId);

    if (user.email === newEmail) {
      return res.json({
        success: false,
        message: "New email cannot be the same as current email"
      });
    }

    const existing = await User.findOne({ email: newEmail });
    if (existing) {
      return res.json({
        success: false,
        message: "Email already exists. Choose another."
      });
    }

  
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

   
    req.session.changeEmailOtp = otp;
    req.session.changeEmailNewEmail = newEmail;
    req.session.changeEmailOtpExpires = Date.now() + (1 * 60 * 1000); 
    req.session.changeEmailCooldown = Date.now() + (60 * 1000); 

    
    await sendOtpMail(newEmail, otp);

   
    console.log("Email Change OTP Sent");
    console.log("New Email:", newEmail);
    console.log("OTP:", otp);
    console.log("Expires At:", new Date(req.session.changeEmailOtpExpires));

    return res.json({ success: true });

  } catch (err) {
    console.log("Send Change Email OTP Error:", err);
    return res.json({ success: false, message: "Server error" });
  }
};


export const resendChangeEmailOtp = async (req, res) => {
  try {
    const now = Date.now();

    
    if (now < req.session.changeEmailCooldown) {
      const remaining = Math.ceil((req.session.changeEmailCooldown - now) / 1000);
      return res.json({
        success: false,
        message: `Please wait ${remaining}s before resending`
      });
    }

    const newEmail = req.session.changeEmailNewEmail;

    if (!newEmail) {
      return res.json({ success: false, message: "No email found in session" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    req.session.changeEmailOtp = otp;
    req.session.changeEmailOtpExpires = now + (1 * 60 * 1000);
    req.session.changeEmailCooldown = now + (60 * 1000);

    await sendOtpMail(newEmail, otp);

    console.log("RESEND Email Change OTP");
    console.log("Email:", newEmail);
    console.log("New OTP:", otp);

    return res.json({ success: true });

  } catch (err) {
    console.log("Resend OTP Error:", err);
    return res.json({ success: false, message: "Server error" });
  }
};


export const verifyChangedEmailOtp = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { otp } = req.body;

    if (!otp) {
      return res.json({ success: false, message: "OTP is required" });
    }

   
    if (Date.now() > req.session.changeEmailOtpExpires) {
      return res.json({ success: false, message: "OTP expired" });
    }

    
    if (otp !== req.session.changeEmailOtp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    const newEmail = req.session.changeEmailNewEmail;

   
    await User.findByIdAndUpdate(userId, { email: newEmail });

   
    req.session.user.email = newEmail;

  
    delete req.session.changeEmailOtp;
    delete req.session.changeEmailNewEmail;
    delete req.session.changeEmailOtpExpires;
    delete req.session.changeEmailCooldown;

    console.log("Email Updated Successfully to:", newEmail);

    return res.json({ success: true, newEmail });

  } catch (err) {
    console.log("Verify OTP Error:", err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};



export const getAddressPage = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await User.findById(userId).lean();

        const addresses = user.addresses || [];

        
        const getAddressTypeIcon = (type) => {
            switch (type) {
                case "home": return "home";
                case "work": return "briefcase";
                default: return "map-marker-alt";
            }
        };

        res.render("user/addressList", {
            user,
            addresses,
            ordersCount: user.orders?.length || 0,
            wishlistCount: user.wishlist?.length || 0,
            unreadNotifications: user.notifications?.filter(n => !n.read).length || 0,
            getAddressTypeIcon  
        });

    } catch (err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
};

export const addAddress = async (req, res) => {
    try {
        const userId = req.session.user.id;

        const newAddress = {
            addressType: req.body.addressType,
            fullName: req.body.fullName,
            phone: req.body.phone,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2||"",
            city: req.body.city,
            state: req.body.state,
            pincode: req.body.pincode,
            country: req.body.country,
            isDefault: req.body.isDefault === "on" || req.body.isDefault === true
        };

        const user = await User.findById(userId);

      
        if (user.addresses.length === 0) {
            newAddress.isDefault = true;
        }

      
        if (newAddress.isDefault) {
            user.addresses.forEach(addr => addr.isDefault = false);
        }

        user.addresses.push(newAddress);
        await user.save();

        res.json({ success: true, message: "Address added successfully" });

    } catch (err) {
        console.error("Add Address Error:", err);
        res.json({ success: false, message: "Server error while adding address" });
    }
};

export const updateAddress = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const addressId = req.params.id;

        const user = await User.findById(userId);

        const address = user.addresses.id(addressId);
        if (!address) return res.json({ success: false, message: "Address not found" });

       
        Object.assign(address, req.body);

      
        if (req.body.isDefault) {
            user.addresses.forEach(a => a.isDefault = false);
            address.isDefault = true;
        }

        await user.save();

        res.json({ success: true, message: "Address updated successfully" });

    } catch (err) {
        console.log(err);
        res.json({ success: false, message: "Error updating address" });
    }
};
export const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user.id;   
        const addressId = req.params.id;


        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found!" });
        }

        const addressExists = user.addresses.some(
            (a) => a._id.toString() === addressId
        );

        if (!addressExists) {
            return res.json({ success: false, message: "Address not found!" });
        }

        user.addresses = user.addresses.filter(
            (a) => a._id.toString() !== addressId
        );

        await user.save();

        return res.json({ success: true, message: "Address deleted successfully" });

    } catch (err) {
        console.log("Delete Error:", err);
        return res.json({ success: false, message: "Error deleting address" });
    }
};

export const setDefaultAddress = async (req, res) => {
  try {
   
    if (!req.user) {
      console.warn("setDefaultAddress: req.user is missing");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userId = req.user._id;
    const addressId = req.params.id;

    if (!addressId) {
      return res.status(400).json({ success: false, message: "Address id required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.warn("setDefaultAddress: user not found", { userId });
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!Array.isArray(user.addresses)) user.addresses = [];

    user.addresses.forEach(a => { a.isDefault = false; });

    const target = user.addresses.id ? user.addresses.id(addressId) : user.addresses.find(a => a._id && a._id.toString() === addressId);

    if (!target) {
      console.warn("setDefaultAddress: target address not found", { addressId });
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    target.isDefault = true;

    await user.save();

    return res.json({ success: true, message: "Default address updated" });

  } catch (err) {
    console.error("Default error:", err);
    return res.status(500).json({ success: false, message: "Error updating default" });
  }
};


export const getSecuritySettings = async (req, res) => {
  try {
   

    if (!req.session.user) return res.redirect('/user/login');

    const userId = req.session.user.id || req.session.user._id;
    console.log("USER ID:", userId);

    const user = await User.findById(userId);
    console.log("USER:", user);

    res.render("user/changepassword", { 
      user,
      ordersCount: 0,
      wishlistCount: 0,
      unreadNotifications: 0,
      activePage: "security"
    });

  } catch (err) {
    console.log("ERROR:", err);
    res.status(500).send("Server error");
  }
};

export const checkCurrentPassword = async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);

        if (!user) return res.json({ valid: false });

        if (user.googleId) {
            return res.json({ valid: false });
        }

        const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
        res.json({ valid: isMatch });

    } catch (err) {
        console.error("Password check error:", err);
        res.json({ valid: false });
    }
};


export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        if (user.googleId) {
            return res.json({
                success: false,
                message: "You logged in using Google. Password change is not required."
            });

        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Incorrect current password" });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        user.password = hashed;
        await user.save();

        return res.json({ success: true, message: "Password updated successfully" });

    } catch (err) {
        console.log("Error updating password:", err);
        return res.json({ success: false, message: "Internal server error" });
    }
};



export const getWishlistPage = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user.id) {
            return res.redirect("/login");
        }

        const user = await User.findById(req.session.user.id)
            .populate({
                path: "wishlist",
                populate: { 
                    path: "category",
                    select: "name"
                }
            });

        let wishlistItems = [];

        for (let product of user.wishlist) {
            let productObj = product.toObject();


            const offerData = await applyOfferToProduct(productObj);

            
            if (offerData && offerData.variants) {
                productObj.variants = productObj.variants.map((v, index) => ({
                    ...v,
                    regularPrice: offerData.variants[index].regularPrice,
                    finalPrice: offerData.variants[index].finalPrice,
                    discountPercent: Math.round(
                        ((offerData.variants[index].regularPrice - offerData.variants[index].finalPrice) /
                        offerData.variants[index].regularPrice) * 100
                    ),
                    appliedOffer: offerData.variants[index].appliedOffer
                }));
            }

            wishlistItems.push(productObj);
        }

        res.render("user/wishlist", {
            activePage: "wishlist",
            user,
            wishlistItems,
            wishlistCount: wishlistItems.length,
            ordersCount: 0,
            unreadNotifications: 0
        });

    } catch (err) {
        console.log("WISHLIST ERROR:", err);
        return res.status(500).send("Error loading wishlist");
    }
};

export const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user.id;  
    const productId = req.params.productId;

    const user = await User.findById(userId);

    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    return res.json({ success: true });

  } catch (error) {
    console.error("Error adding to wishlist:", error);
    return res.status(500).json({ success: false });
  }
};


export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user.id;  
    const productId = req.params.productId;

    await User.findByIdAndUpdate(userId, {
      $pull: { wishlist: productId }
    });

    return res.json({ success: true });

  } catch (error) {
    console.error("Error removing from wishlist:", error);
    return res.status(500).json({ success: false });
  }
};


export const toggleWishlist = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const productId = req.params.productId;

        const user = await User.findById(userId);

        if (!user) return res.json({ success: false, message: "User not found" });

        let added = false;

        if (user.wishlist.includes(productId)) {
            user.wishlist.pull(productId);
            await user.save();
            return res.json({ success: true, added: false, message: "Removed from wishlist" });
        } else {
            user.wishlist.push(productId);
            await user.save();
            return res.json({ success: true, added: true, message: "Added to wishlist" });
        }
       
    } catch (err) {
        console.log(err);
        res.json({ success: false, message: "Something went wrong" });
    }
};

export const getCheckoutPage = (req, res) => {
    res.render("user/checkout", {
        user: req.session.user,
        ordersCount: 0,
        wishlistCount: req.session.user?.wishlistCount || 0,
        unreadNotifications: 0
    });
};




export const logoutUser = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destroy error:", err);
      return res.redirect("/");
    }
    res.clearCookie("connect.sid");
    res.redirect("/user/login");
  });
};
