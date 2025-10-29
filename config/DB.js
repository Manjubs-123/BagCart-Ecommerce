import mongoose from "mongoose";
import dotenv from "dotenv";
// import Category from "../models/category.js";

dotenv.config();

const connectDB = async () => {
    try {
        // await mongoose.connect('mongodb+srv://manjubs86087_db_user:12345@bagcart-ecommerce.n3gywec.mongodb.net/bagcart?retryWrites=true&w=majority')
        await mongoose.connect(process.env.MONGO_URI)
        console.log('Mongo connected');

    } catch (error) {
        console.error('Mongo connection error:', error.message);
        process.exit(1); // Exit process with failure
    }
}





export default connectDB;