// // import mongoose from "mongoose";
// // import dotenv from "dotenv";
// // // import Category from "../models/category.js";

// // dotenv.config();

// // const connectDB = async () => {
// //     try {
// //         // await mongoose.connect('mongodb+srv://manjubs86087_db_user:12345@bagcart-ecommerce.n3gywec.mongodb.net/bagcart?retryWrites=true&w=majority')
// //         await mongoose.connect(process.env.MONGO_URI)
// //         console.log('Mongo connected');

// //     } catch (error) {
// //         console.error('Mongo connection error:', error.message);
// //         process.exit(1); // Exit process with failure
// //     }
// // }





// // export default connectDB;
// // config/db.js
// import mongoose from "mongoose";

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log(`✅ MongoDB connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error(`❌ Database Connection failed: ${error.message}`);
//     process.exit(1);
//   }
// };

// export default connectDB;


import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
