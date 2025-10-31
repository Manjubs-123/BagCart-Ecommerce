import {v2 as cloudinary }from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";  
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

//Cloudinary configuration

cloudinary.config({ 
cloud_name:process.env.CLOUD_NAME,
api_key:process.env.CLOUD_API_KEY,
api_secret:process.env.CLOUD_API_SECRET,
});

//Storage engine setup
const storage=new CloudinaryStorage({
    cloudinary:cloudinary,
    params:{
        folder:"products",
        allowed_formats:["jpg","png","jpeg"],
    },
});

//Multer upload Middleware
const upload=multer ({storage});
export {cloudinary,upload};