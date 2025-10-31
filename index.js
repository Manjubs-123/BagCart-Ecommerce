import express from 'express';
import session  from 'express-session';
import passport from 'passport';
import dotenv from "dotenv";
dotenv.config(); 
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import userRoutes from "./routes/userRoutes.js"
import userAuthRoutes from "./routes/authRoutes.js"
import "./config/passport.js"
import adminRoutes from "./routes/adminRoutes.js";
import usersRoutes from "./routes/admin/usersRoutes.js";
import categoryRoutes from "./routes/admin/categoryRoutes.js";
import productRoutes from './routes/admin/productRoutes.js';
import connectDB from './config/DB.js';
import shopRoutes from "./routes/shopRoute.js";


const app = express()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')));



app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
//sessions 
// ✅ Setup express-session correctly
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // ❗ false if you're using HTTP (localhost)
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

connectDB()

const bags = [
    { id: 1, name: "Travel Backpack", price: 1999, image: "/images/img.jpg" },
    { id: 2, name: "Ofiice Laptop Bag", price: 2499, image: "/images/bag2.jpg" },
    { id: 3, name: "Hiking Rucksack", price: 2799, image: "/images/bag3.jpg" },
    

];

//Routes
app.use("/user",userRoutes);
app.use("/auth",userAuthRoutes);
app.use("/admin",adminRoutes);
app.use("/admin/users",usersRoutes);
app.use("/admin/category",categoryRoutes);
app.use("/admin/products",productRoutes);
app.use("/", shopRoutes);


app.get("/test", (req, res) => {
  res.sendFile(path.join(__dirname, "public/images/img1.png"));
});
// app.get("/",(req,res)=>{
//     const user=req.session.user||null;
//     res.render("index",{user,bags});
// });
app.get('/', (req, res) => {
  res.render('user/landing');
})


const PORT = 3000

// The server is started in the bootstrap function above
 app.listen(PORT, () => {
    console.log(`The server is running on port ${PORT}`);
});