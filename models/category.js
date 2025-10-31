import mongoose from "mongoose";
const categorySchema=new mongoose.Schema({
    name:{type:String,required:true,trim:true,unique:true},
    description:{type:String,trim:true},
    isDeleted:{type:Boolean,default:false},
    isActive:{type:Boolean,default:true},

},{timestamps:true});

const Category = mongoose.models.Category || mongoose.model("Category", categorySchema);

export default Category;