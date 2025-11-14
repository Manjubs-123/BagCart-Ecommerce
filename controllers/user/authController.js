import bcrypt from "bcryptjs";
import otpGenerator from "otp-generator";
import User from "../../models/userModel.js";

// Render login page
// export const renderLogin = (req, res) => {
//   res.render("user/login", {error: null });
// };

// Handle login form submission
// export const loginUser = async (req, res) => {
//   const { email, password } = req.body;
  

//  try {
    //  Check if email exists
    // const user = await User.findOne({ email });
    // if (!user) {
    //   return res.render("user/login", {
    //     error: "Email not registered. Please signup first.",
    //   });
    // }

    //  Check if email is verified
    // if (!user.isVerified) {
    //   return res.render("user/login", {
    //     error: "Please verify your email before logging in.",
    //   });
    // }

    //  Compare password
    // const isMatch = await bcrypt.compare(password, user.password);
    // if (!isMatch) {
    //   return res.render("user/login", {
    //     error: "Incorrect password. Please try again.",
    //   });
    // }

    //  Success: create session and redirect
//     req.session.user = {
//       id: user._id,
//       name: user.name,
//       email: user.email,
//     };
//     res.redirect("/user/landing");

//   } catch (err) {
//     console.error("Login error:", err.message);
//     res.status(500).render("user/login", {
//       error: "Something went wrong. Please try again later.",
//     });
//   }
// };


// Step 1: Send OTP
// export const sendOtp = async (req, res) => {
//   try {
//     const { email } = req.body;
//     let user = await User.findOne({ email });

//     if (!user) {
//       user = new User({ name: "Guest User", email });
//       await user.save();
//     }

//     const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false });

    // Store OTP in session (not DB)
//     req.session.otp = otp;
//     req.session.email = email;
//     req.session.otpExpires = Date.now() + 2 * 60 * 1000; // 2 min expiry

//     console.log("Generated OTP:", otp);
//     // (Send OTP via email or SMS here)

//     res.render("verify-otp", { message: "OTP sent successfully" });
//   } catch (err) {
//     console.error("Error sending OTP:", err);
//     res.status(500).send("Error sending OTP");
//   }
// };

// Step 2: Verify OTP
// export const verifyOtp = async (req, res) => {
//   try {
//     const { otp } = req.body;
//     const { email, otp: storedOtp, otpExpires } = req.session;

//     if (!storedOtp || Date.now() > otpExpires)
//       return res.render("verify-otp", { error: "OTP expired. Please request a new one." });

//     if (otp !== storedOtp)
//       return res.render("verify-otp", { error: "Invalid OTP. Try again." });

    // OTP matched — verify user
    // const user = await User.findOne({ email });
    // if (user) {
    //   user.isVerified = true;
    //   await user.save();
    // }

    // Create session
    // req.session.isLoggedIn = true;
    // req.session.user = { id: user._id, name: user.name, email: user.email };

    // Clear OTP data from session
//     delete req.session.otp;
//     delete req.session.otpExpires;

//     res.redirect("/home");
//   } catch (err) {
//     console.error("Error verifying OTP:", err);
//     res.status(500).send("Error verifying OTP");
//   }
// };

//  Step 3: Logout
// export const logoutUser = (req, res) => {
//   req.session.destroy((err) => {
//     if (err) console.error(err);
//     res.clearCookie("connect.sid");
//     res.redirect("/login");
//   });
// };
