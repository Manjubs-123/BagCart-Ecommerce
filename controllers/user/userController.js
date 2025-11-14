import User from "../../models/userModel.js";
import { sendOtpMail } from "../../utils/sendMail.js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import {loadHomeProducts,renderLandingPage} from "./productController.js";  

// Email setup (Gmail SMTP)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Render Signup Page
export const getSignup = (req, res) => {
  res.render("user/signup", { error: null });
};

// Handle Signup Submission
export const signupUser = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error("DB not connected - readyState:", mongoose.connection.readyState);
      return res.status(503).render("user/signup", {
        error: "Service temporarily unavailable. Please try again later.",
      });
    }

    const { name, email, password, confirmPassword } = req.body;

    // --- Validation ---
    if (!name?.trim()) return res.render("user/signup", { error: "Name is required." });
    if (name.trim().length < 6) return res.render("user/signup", { error: "Name must be at least 6 characters." });
    if (!/^[a-zA-Z\s]+$/.test(name)) return res.render("user/signup", { error: "Name can contain only alphabets." });

    if (!email?.endsWith("@gmail.com")) return res.render("user/signup", { error: "Enter a valid Gmail address." });

    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.render("user/signup", {
        error: "Password must have 1 uppercase, 1 number, 1 special char, and be ≥6 chars long.",
      });
    }
    if (password !== confirmPassword) {
      return res.render("user/signup", { error: "Passwords do not match." });
    }

    // --- Check existing user ---
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isVerified) {
      return res.render("user/signup", { error: "Email already registered. Please login." });
    } else if (existingUser && !existingUser.isVerified) {
      await User.deleteOne({ _id: existingUser._id });
    }

    // --- Create new user ---
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
    });
    await newUser.save();

    // --- Generate OTP and store in session ---
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.otp = otp;
    req.session.email = email;
    req.session.otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes

    // --- Send OTP via email ---
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for BagCart Signup",
      html: `<p>Hello ${name},</p>
             <p>Your OTP is <b>${otp}</b>. It will expire in 2 minutes.</p>`,
    });

    console.log(` OTP sent to ${email}: ${otp}`);
    req.session.pendingEmail = email; // store securely in session
    res.redirect("/user/verifyOtp");
  } catch (err) {
    console.error(" Signup error:", err);
    res.status(500).render("user/signup", { error: "Something went wrong. Please try again later." });
  }
}; 


export const getVerifyOtp = (req, res) => {
  const email = req.session.pendingEmail;

  if (!email) return res.redirect("/user/signup"); // if session lost or expired

  // Add constants here 
  const RESEND_COOLDOWN = 60; // seconds before user can resend OTP
  const OTP_EXPIRY_MINUTES = 2; // OTP valid time (in minutes)
  const cooldown = req.session.cooldown || 0;

  // Render page with all required variables
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
      return res.render("user/verifyOtp", { email, error: "OTP expired. Please sign up again." });
    }

    if (otp !== storedOtp) {
      return res.render("user/verifyOtp", { email, error: "Invalid OTP. Please try again." });
    }

    const user = await User.findOne({ email });
    if (!user) return res.render("user/signup", { error: "User not found. Please sign up again." });

    user.isVerified = true;
    await user.save();

    req.session.isLoggedIn = true;
    req.session.user = { id: user._id, name: user.name, email: user.email };

    // Clean up
    delete req.session.otp;
    delete req.session.otpExpires;
    delete req.session.pendingEmail;
    delete req.session.cooldown;


    res.redirect("/user/home");
  } catch (err) {
    console.error("OTP Verification Error:", err);
    res.status(500).render("user/verifyOtp", { email: req.session.pendingEmail || "", error: "Something went wrong." });
  }
};


export const resendOtp = async (req, res) => {
  try {
    const email = req.session.pendingEmail;
    if (!email) return res.redirect("/user/signup");

    const now = Date.now();
    const cooldown = req.session.cooldown || 0;

    // Prevent resend spam
    if (now < cooldown) {
      const remaining = Math.ceil((cooldown - now) / 1000);
      return res.render("user/verifyOtp", {
        email,
        error: `Please wait ${remaining}s before resending OTP.`,
        cooldown: remaining,
        RESEND_COOLDOWN: 60,
        OTP_EXPIRY_MINUTES: 2,
      });
    }

    // New OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.otp = newOtp;
    req.session.otpExpires = now + 5 * 60 * 1000;
    req.session.cooldown = now + 60 * 1000;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "New OTP for BagCart Verification",
      html: `<p>Your new OTP is <b>${newOtp}</b>. It will expire in 5 minutes.</p>`,
    });

    // console.log(` Resent OTP to ${email}: ${newOtp}`);

    res.render("user/verifyOtp", {
      email,
      error: null,
      cooldown: 60,
      RESEND_COOLDOWN: 60,
      OTP_EXPIRY_MINUTES: 2,
    });
  } catch (err) {
    console.error("Resend OTP Error:", err);
    res.render("user/verifyOtp", {
      email: req.session.pendingEmail || "",
      error: "Failed to resend OTP. Please try again.",
      cooldown: 0,
      RESEND_COOLDOWN: 60,
      OTP_EXPIRY_MINUTES: 2,
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


//  Handle Login (with block check)
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.render("user/login", { error: "No account found with this email." });
    if (user.isBlocked) return res.render("user/login", { error: "Your account has been blocked by admin." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.render("user/login", { error: "Invalid email or password." });

    req.session.isLoggedIn = true;
    req.session.user = { id: user._id, name: user.name, email: user.email };

    res.redirect("/user/landing");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).render("user/login", { error: "Something went wrong. Please try again." });
  }
};

//  Show Landing Page (Home)
export const showHomePage = async (req, res) => {
  return renderLandingPage(req, res);
};


//  Logout User
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
