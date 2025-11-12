import mongoose from "mongoose";
const userSchema=new mongoose.Schema({
    
    name:{type:String,required:true,trim:true},
    email:{type:String,required:true,unique:true,lowercase:true},
    password:{type:String},
    googleId:{type:String, sparse: true},
    resetPasswordToken:{type:String},
    resetPasswordExpires:{type:Date},
    isVerified:{type:Boolean,default:false}, 
    isBlocked:{type:Boolean,default:false},
    createdAt:{type:Date,default:Date.now},
},{timestamps:true});

 const User= mongoose.model("User",userSchema);
 export default User;
