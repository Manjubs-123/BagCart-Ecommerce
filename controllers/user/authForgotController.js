import bcrypt from "bcryptjs";
import User from "../../models/userModel.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();


// Render Forgot Password Page
 export const renderForgotPassword=(req,res)=>{
    res.render("user/forgotPassword",{ error:null});
 };

 //Handle email submission
 export const postForgotPassword=async (req,res)=>{
    const {email}=req.body;

    try{
        const user=await User.findOne({email});
        if(!user){
            return res.render("user/forgotPassword",{error:"Email not registered."});        
    }

    //Generate OTP
    const otp=Math.floor(100000+Math.random()*900000).toString();
    user.resetotp=otp;
    user.otpExpiry=Date.now()+5*60*1000;
    await user.save();

    //Send OTP via email
    let transporter=nodemailer.createTransport({
        service:"Gmail",
        auth:{
            user:process.env.EMAIL_USER,
            pass:process.env.EMAIL_PASS,

        },
    });

    await transporter.sendMail({
        from:`"BagHub"<${process.env.EMAIL_USER}>`,
        to:email,
        subject:"Your OTP for Password Reset",
        text:`Your OTP is:${otp}.It expires in 5 minutes.`,
    });

    res.redirect(`/user/forgotOtp?email=${email}`);
}catch(err){
    console.error(err);
    res.render("user/forgotPassword",{error:"Something went wrong. Please try again later."});
}
 };

 //Rensed OTP page
 export const renderForgotVerifyOtp= (req,res)=>{
    const {email}=req.query;
    res.render("user/forgotOtp",{email,error:null});

 };
// ✅ Verify OTP
export const postForgotVerifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.render("user/forgotOtp", { email, error: "Email not found." });
  }

  if (user.resetotp !== otp || Date.now() > user.otpExpiry) {
    return res.render("user/forgotOtp", { email, error: "OTP invalid or expired." });
  }

  // ✅ OTP correct - redirect to reset password
  user.resetotp = null;
  user.otpExpiry = null;
  await user.save();

  res.redirect(`/user/resetPassword?email=${email}`);
};

// ✅ Render Reset Password Page
export const renderResetPassword = (req, res) => {
  const { email } = req.query;
  // Always render with error: null if first time loading
  res.render("user/resetPassword", { email, error: null });
};

// ✅ Handle Reset Password Form Submission
export const postResetPassword = async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  try {
    const passwordRegex=/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+{}:"<>?~]).{6,}$/;

    if(!passwordRegex.test(newPassword)){
      return res.render("user/resetPassword",{
        email,error:"Password must be at least 6 characters long and include at least one uppercase letter, one number, and one special character.",

      });
        
    }

    if (newPassword !== confirmPassword) {
      // ❗ Re-render same page WITH error message
      return res.render("user/resetPassword", {
        email,
        error: "Passwords do not match.",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { email },
      { $set: { password: hashed, resetotp: null, otpExpiry: null } }
    );

    // ✅ Redirect to login page after successful reset
    return res.redirect("/user/login");
  } catch (error) {
    console.error("Password reset error:", error);
    return res.render("user/resetPassword", {
      email,
      error: "Something went wrong. Please try again.",
    });
  }
};
