import bcrypt from "bcryptjs";
import User from "../../models/userModel.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const OTP_EXPIRY_MS = 1 * 60 * 1000;   
const RESEND_COOLDOWN_MS = 1 * 60 * 1000;  


export const renderForgotPassword = (req, res) => {
  res.render("user/forgotPassword", { error: null });
};


export const postForgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.render("user/forgotPassword", { error: "Enter a valid email address." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.render("user/forgotPassword", { error: "Email not registered." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();

    req.session.resetData = {
      email,
      otp,
      otpExpiry: now + OTP_EXPIRY_MS,
      cooldown: now + RESEND_COOLDOWN_MS
    };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"BagHub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "BagHub Password Reset OTP",
      html: `<p>Your OTP for password reset is <b>${otp}</b>. It expires in 1 minute.</p>`,
    });

   
    if (process.env.NODE_ENV !== "production") {
      console.log(`Forgot Password OTP sent to ${email}: ${otp}`);
    }

    
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/user/forgotOtp");
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.render("user/forgotPassword", { error: "Something went wrong. Please try again." });
  }
};


export const renderForgotVerifyOtp = (req, res) => {
  const email = req.session.resetData?.email;
  if (!email) return res.redirect("/user/forgotPassword");

  const cooldown = req.session.resetData?.cooldown || 0;
  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((cooldown - now) / 1000));

  res.render("user/forgotOtp", {
    email,
    error: null,
    cooldown: remaining,
    RESEND_COOLDOWN: 60,
    OTP_EXPIRY_MINUTES: 1,
  });
};


export const postForgotVerifyOtp = async (req, res) => {
  const { otp } = req.body;
  const data = req.session.resetData;

  if (!data || !data.email) return res.redirect("/user/forgotPassword");

  if (Date.now() > data.otpExpiry) {
    return res.render("user/forgotOtp", {
      email: data.email,
      error: "OTP expired. Please request a new one.",
    });
  }

  if (otp.trim() !== String(data.otp)) {
    return res.render("user/forgotOtp", {
      email: data.email,
      error: "Invalid OTP. Please try again.",
    });
  }

  req.session.allowPasswordReset = true;

  req.session.save((err) => {
    if (err) {
      console.error("Session save failed:", err);
      return res.render("user/forgotOtp", {
        email: data.email,
        error: "Session issue. Try again.",
      });
    }
    res.redirect("/user/resetPassword");
  });
};

export const resendForgotOtp = async (req, res) => {
  try {
    const data = req.session.resetData;
    if (!data || !data.email) return res.redirect("/user/forgotPassword");

    const now = Date.now();
    if (now < data.cooldown) {
      const remaining = Math.ceil((data.cooldown - now) / 1000);
      return res.render("user/forgotOtp", {
        email: data.email,
        error: `Please wait ${remaining}s before resending.`,
        cooldown: remaining,
        RESEND_COOLDOWN: 60,
        OTP_EXPIRY_MINUTES: 1,
      });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.resetData.otp = newOtp;
    req.session.resetData.otpExpiry = now + OTP_EXPIRY_MS;
    req.session.resetData.cooldown = now + RESEND_COOLDOWN_MS;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"BagHub" <${process.env.EMAIL_USER}>`,
      to: data.email,
      subject: "New OTP for Password Reset",
      html: `<p>Your new OTP is <b>${newOtp}</b>. It expires in 1 minute.</p>`,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`Forgot Password Resend OTP to ${data.email}: ${newOtp}`);
    }

    req.session.save((err) => {
      if (err) {
        console.error("Session save error after resend:", err);
        return res.render("user/forgotOtp", {
          email: data.email,
          error: "Failed to update session. Try again.",
          cooldown: 0,
          RESEND_COOLDOWN: 60,
          OTP_EXPIRY_MINUTES: 1,
        });
      }

      return res.render("user/forgotOtp", {
        email: data.email,
        error: null,
        cooldown: 60,
        RESEND_COOLDOWN: 60,
        OTP_EXPIRY_MINUTES: 1,
      });
    });

  } catch (err) {
    console.error("Resend OTP Error:", err);
    res.render("user/forgotOtp", {
      email: req.session.resetData?.email || "",
      error: "Failed to resend OTP. Please try again.",
      cooldown: 0,
      RESEND_COOLDOWN: 60,
      OTP_EXPIRY_MINUTES: 1,
    });
  }
};

export const renderResetPassword = (req, res) => {
  if (!req.session.allowPasswordReset) return res.redirect("/user/forgotPassword");

  const email = req.session.resetData?.email;
  res.render("user/resetPassword", { email, error: null });
};

export const postResetPassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const email = req.session.resetData?.email;

  if (!email) return res.redirect("/user/forgotPassword");

  try {
    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+{}:"<>?~]).{6,}$/;

    if (!passwordRegex.test(newPassword)) {
      return res.render("user/resetPassword", {
        email,
        error: "Password must include uppercase, number, special char, and be 6+ chars.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.render("user/resetPassword", {
        email,
        error: "Passwords do not match.",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email }, { $set: { password: hashed } });

    delete req.session.resetData;
    delete req.session.allowPasswordReset;

    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
      res.clearCookie("connect.sid");
      return res.redirect("/user/login");
    });
  } catch (err) {
    console.error("Password reset error:", err);
    res.render("user/resetPassword", {
      email,
      error: "Something went wrong. Please try again.",
    });
  }
};
