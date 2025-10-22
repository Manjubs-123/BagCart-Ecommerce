import User from "../../models/userModel.js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// ✅ Configure email transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // use SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // MUST be your Gmail App Password
    },
});

// ✅ Render Signup Page
export const getsignup = (req, res) => {
    res.render("user/signup", { error: null });
};

// ✅ Handle Signup Submission
export const signupUser = async (req, res) => {
    try {
        // Check DB connection
        if (mongoose.connection.readyState !== 1) {
            console.error("Database not connected - readyState:", mongoose.connection.readyState);
            return res.status(503).render("user/signup", {
                error: "Cannot process signup right now — database not connected. Please try again later.",
            });
        }

        const { name, email, password, confirmPassword } = req.body;

        // --- Name Validation ---
        if (!name || name.trim().length === 0) {
            return res.status(400).render("user/signup", { error: "Name is required." });
        }
        if (name.trim().length < 6) {
            return res.status(400).render("user/signup", { error: "Name must be at least 6 characters long." });
        }
        const nameRegex = /^[a-zA-Z\s]+$/;
        if (!nameRegex.test(name)) {
            return res.status(400).render("user/signup", { error: "Name can only contain alphabets and spaces." });
        }

        // --- Email Validation ---
        if (!email || !email.endsWith("@gmail.com")) {
            return res.status(400).render("user/signup", {
                error: "Please enter a valid Gmail address (example@gmail.com).",
            });
        }

        // --- Password Validation ---
        const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+{}:"<>?~]).{6,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).render("user/signup", {
                error:
                    "Password must be at least 6 characters long and include 1 uppercase, 1 number, and 1 special character.",
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).render("user/signup", { error: "Passwords do not match." });
        }

        // --- Check if user already exists ---
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.isVerified) {
            return res.status(400).render("user/signup", { error: "Email is already registered. Please login." });
        } else if (existingUser && !existingUser.isVerified) {
            await User.deleteOne({ _id: existingUser._id });
        }

        // --- Create New User ---
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            otp,
            otpExpires,
            isVerified: false,
        });

        await newUser.save();

        // --- Send OTP via Email ---
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your OTP for BagCart Signup",
            html: `
                <p>Hello ${name},</p>
                <p>Your OTP is <b>${otp}</b>. It will expire in 5 minutes.</p>
            `,
        });

        console.log(`✅ OTP sent to ${email}: ${otp}`);

        res.redirect(`/user/verifyOtp?email=${email}`);
    } catch (err) {
        console.error("❌ Signup failed:", err);
        res.status(500).render("user/signup", {
            error: "Something went wrong. Please try again later.",
        });
    }
};

// ✅ Render OTP Page
export const getVerifyOtp = (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.redirect("/user/signup");
    }
    res.render("user/verifyOtp", { email, error: null });
};
// Show public home page
export const showHomePage = (req, res) => {
  res.render("user/index", { title: "BagHub - Explore Backpacks", isLoggedIn: false });
};

// Show landing page (after OTP)
export const showLandingPage = (req, res) => {
  res.render("user/landing", { title: "Welcome to BagHub!", isLoggedIn: true });
};


// ✅ Verify OTP Submission
export const postVerifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email }); 

        if (!user) {
            return res.render("user/verifyOtp", { email, error: "User not found. Please sign up again." });
        }

        if (user.otp !== otp) {
            return res.render("user/verifyOtp", { email, error: "Invalid OTP. Please try again." });
        }

        if (user.otpExpires < Date.now()) {
            await User.deleteOne({ _id: user._id });
            return res.render("user/signup", { error: "OTP expired. Please sign up again." });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.render("user/landing", { email, error: null });
    } catch (err) {
        console.error("❌ OTP Verification error:", err);
        res.status(500).render("user/verifyOtp", {
            email: req.body.email || "",
            error: "Something went wrong. Please try again later.",
        });
    }
};
