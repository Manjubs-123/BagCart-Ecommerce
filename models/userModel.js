import mongoose from "mongoose";
const userSchema=new mongoose.Schema({
    
    name:{type:String,required:true},
    email:{type:String,required:true,unique:true},
    password:{type:String},
    googleId:{type:String},
    resetPasswordToken:{type:String},
    resetPasswordExpires:{type:Date},
    otp:String,
    otpExpires:Date,
    isVerified:{type:Boolean,default:false}
},{timestamps:true});

 const User= mongoose.model("User",userSchema);
 export default User;
