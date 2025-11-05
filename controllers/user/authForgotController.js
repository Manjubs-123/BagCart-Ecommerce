// import bcrypt from "bcryptjs";
// import User from "../../models/userModel.js";
// import nodemailer from "nodemailer";
// import dotenv from "dotenv";
// dotenv.config();


// // Render Forgot Password Page
//  export const renderForgotPassword=(req,res)=>{
//     res.render("user/forgotPassword",{ error:null});
//  };

//  //Handle email submission
//  export const postForgotPassword = async (req, res) => {
//   const { email } = req.body;

//   try {
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.render("user/forgotPassword", { error: "Email not registered." });
//     }

//     // Generate OTP
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     // Store OTP in session instead of DB
//     req.session.resetData = {
//       email,
//       otp,
//       otpExpiry: Date.now() + 5 * 60 * 1000, // 5 minutes validity
//     };

//     // Send OTP via email
//     const transporter = nodemailer.createTransport({
//       service: "Gmail",
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });

//     await transporter.sendMail({
//       from: `"BagHub" <${process.env.EMAIL_USER}>`,
//       to: email,
//       subject: "Your OTP for Password Reset",
//       text: `Your OTP is: ${otp}. It will expire in 5 minutes.`,
//     });

//     res.redirect("/user/forgotOtp");
//   } catch (err) {
//     console.error(err);
//     res.render("user/forgotPassword", {
//       error: "Something went wrong. Please try again later.",
//     });
//   }
// };


//  //Rensed OTP page
// export const renderForgotVerifyOtp = (req, res) => {
//   const email = req.session.resetData?.email;
//   if (!email) return res.redirect("/user/forgotPassword");

//   res.render("user/forgotOtp", { email, error: null });
// };

// // Verify OTP
// // export const postForgotVerifyOtp = async (req, res) => {
// //   const { otp } = req.body;
// //   const data = req.session.resetData;

// //   //if session not foound
// //   if (!data || !data.email) {
// //     return res.redirect("/user/forgotPassword");
// //   }

// //   //check otp expiry
// //   if (Date.now() > data.otpExpiry) {
// //     return res.render("user/forgotOtp", {
// //       email: data.email,
// //       error: "OTP expired. Please request again.",
// //     });
// //   }

// //   //check otp matched
// //   if (otp.trim() !== String(data.otp)) {
// //     return res.render("user/forgotOtp", {
// //       email: data.email,
// //       error: "Incorrect OTP. Please try again.",
// //     });
// //   }

// //   // OTP verified
// //   req.session.allowPasswordReset = true; // mark verified

// //   console.log("OTP verified! Redirecting to reset password...");
// // console.log("Session allowPasswordReset:", req.session.allowPasswordReset);

// //   res.redirect(`/user/resetPassword`);
// // };
// export const postForgotVerifyOtp = async (req, res) => {
//   try {
//     const { email, otp } = req.body;

//     // ✅ Get the stored OTP from session or DB
//     const storedOtp = req.session.forgotOtp;
//     const storedEmail = req.session.forgotEmail;

//     // 🔒 Basic validation
//     if (!storedOtp || !storedEmail || storedEmail !== email) {
//       return res.render("user/forgotOtp", {
//         email,
//         error: "Session expired. Please request a new OTP.",
//       });
//     }

//     if (storedOtp !== otp) {
//       return res.render("user/forgotOtp", {
//         email,
//         error: "Invalid OTP. Please try again.",
//       });
//     }

//     // ✅ OTP matched — proceed to reset password page
//     // Clear OTP session for security
//     req.session.forgotOtp = null;

//     // Save verified email in session for next page
//     req.session.resetEmail = email;
// req.session.allowPasswordReset = true;
//     return res.render("user/resetPassword", {
//       email,
//       error: null,
//     });

//   } catch (err) {
//     console.error("OTP verification error:", err);
//     return res.render("user/forgotOtp", {
//       email: req.body.email,
//       error: "Something went wrong. Please try again later.",
//     });
//   }
// };


// // Render Reset Password Page
// export const renderResetPassword = (req, res) => {
//   if (!req.session.allowPasswordReset) {
//     return res.redirect("/user/forgotPassword");
//   }

  
//   res.render("user/resetPassword", { error: null });
// };

// // Handle Reset Password Form Submission
// export const postResetPassword = async (req, res) => {
//   const { newPassword, confirmPassword } = req.body;
//   const email = req.session.resetData?.email;

//   if (!email) return res.redirect("/user/forgotPassword");

//   try {
//     const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+{}:"<>?~]).{6,}$/;
//     if (!passwordRegex.test(newPassword)) {
//       return res.render("user/resetPassword", {
//         email,
//         error:
//           "Password must include one uppercase letter, one number, one special character, and be at least 6 characters long.",
//       });
//     }

//     if (newPassword !== confirmPassword) {
//       return res.render("user/resetPassword", {
//         email,
//         error: "Passwords do not match.",
//       });
//     }

//     const hashed = await bcrypt.hash(newPassword, 10);
//     await User.updateOne({ email }, { $set: { password: hashed } });

//     // ✅ Clear session after success
//     req.session.resetData = null;
//     req.session.allowPasswordReset = null;

//     res.redirect("/user/login");
//   } catch (err) {
//     console.error(err);
//     res.render("user/resetPassword", {
//       email,
//       error: "Something went wrong. Please try again.",
//     });
//   }
// };

import bcrypt from "bcryptjs";
import User from "../../models/userModel.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

/* ============================================================
   1️ Render Forgot Password Page
============================================================ */
export const renderForgotPassword = (req, res) => {
  res.render("user/forgotPassword", { error: null });
};

/* ============================================================
   2️ Handle Forgot Password Form (Send OTP)
============================================================ */
export const postForgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render("user/forgotPassword", {
        error: "Email not registered.",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP + email in session
    req.session.resetData = {
      email,
      otp,
      otpExpiry: Date.now() + 5 * 60 * 1000, // valid for 5 mins
    };

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"BagHub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP for Password Reset",
      text: `Your OTP is: ${otp}. It will expire in 5 minutes.`,
    });

    //  Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.render("user/forgotPassword", {
          error: "Something went wrong. Please try again.",
        });
      }
      res.redirect("/user/forgotOtp");
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.render("user/forgotPassword", {
      error: "Something went wrong. Please try again later.",
    });
  }
};

/* ============================================================
   3️ Render OTP Verification Page
============================================================ */
export const renderForgotVerifyOtp = (req, res) => {
  const email = req.session.resetData?.email;
  if (!email) return res.redirect("/user/forgotPassword");

  res.render("user/forgotOtp", { email, error: null });
};

/* ============================================================
   4️ Handle OTP Verification
============================================================ */
export const postForgotVerifyOtp = async (req, res) => {
  const { otp } = req.body;
  const data = req.session.resetData;

  // If session or email missing
  if (!data || !data.email) {
    return res.redirect("/user/forgotPassword");
  }

  // Check expiry
  if (Date.now() > data.otpExpiry) {
    return res.render("user/forgotOtp", {
      email: data.email,
      error: "OTP expired. Please request again.",
    });
  }

  // Check OTP match
  if (otp.trim() !== String(data.otp)) {
    return res.render("user/forgotOtp", {
      email: data.email,
      error: "Incorrect OTP. Please try again.",
    });
  }

  //  OTP verified
  req.session.allowPasswordReset = true;

  // Save before redirect
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

/* ============================================================
   5️ Render Reset Password Page
============================================================ */
export const renderResetPassword = (req, res) => {
  if (!req.session.allowPasswordReset) {
    return res.redirect("/user/forgotPassword");
  }

  const email = req.session.resetData?.email;
  res.render("user/resetPassword", { email, error: null });
};

// export const renderResetPassword = (req, res) => {
//   if (!req.session.allowPasswordReset) {
//     return res.redirect("/user/forgotPassword");
//   }

  
//   res.render("user/resetPassword", { error: null });
// };

/* ============================================================
   6️ Handle Reset Password Submission
============================================================ */
export const postResetPassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const email = req.session.resetData?.email;

  if (!email) return res.redirect("/user/forgotPassword");

  try {
    const passwordRegex =
      /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+{}:"<>?~]).{6,}$/;

    if (!passwordRegex.test(newPassword)) {
      return res.render("user/resetPassword", {
        email,
        error:
          "Password must include an uppercase letter, number, special character, and be at least 6 characters.",
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

    //  Clear session data
    req.session.resetData = null;
    req.session.allowPasswordReset = null;

    res.redirect("/user/login");
  } catch (err) {
    console.error("Password reset error:", err);
    res.render("user/resetPassword", {
      email,
      error: "Something went wrong. Please try again.",
    });
  }
};

// // Handle Reset Password Form Submission

// export const postResetPassword = async (req, res) => {
//   const { newPassword, confirmPassword } = req.body;
//   const email = req.session.resetData?.email;

//   if (!email) return res.redirect("/user/forgotPassword");

//   try {
//     const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+{}:"<>?~]).{6,}$/;
//     if (!passwordRegex.test(newPassword)) {
//       return res.render("user/resetPassword", {
//         email,
//         error:
//           "Password must include one uppercase letter, one number, one special character, and be at least 6 characters long.",
//       });
//     }

//     if (newPassword !== confirmPassword) {
//       return res.render("user/resetPassword", {
//         email,
//         error: "Passwords do not match.",
//       });
//     }

//     const hashed = await bcrypt.hash(newPassword, 10);
//     await User.updateOne({ email }, { $set: { password: hashed } });

//     // ✅ Clear session after success
//     req.session.resetData = null;
//     req.session.allowPasswordReset = null;

//     res.redirect("/user/login");
//   } catch (err) {
//     console.error(err);
//     res.render("user/resetPassword", {
//       email,
//       error: "Something went wrong. Please try again.",
//     });
//   }
// };
