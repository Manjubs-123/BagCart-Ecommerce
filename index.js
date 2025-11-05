// import express from 'express';
// import session  from 'express-session';
// import passport from 'passport';
// import dotenv from "dotenv";
// dotenv.config(); 
// import path from 'path';
// import { fileURLToPath } from 'url';
// import mongoose from 'mongoose';
// import userRoutes from "./routes/userRoutes.js"
// import userAuthRoutes from "./routes/authRoutes.js"
// import "./config/passport.js"
// import adminRoutes from "./routes/adminRoutes.js";
// import usersRoutes from "./routes/admin/usersRoutes.js";
// import categoryRoutes from "./routes/admin/categoryRoutes.js";
// import productRoutes from './routes/admin/productRoutes.js';
// import connectDB from './config/DB.js';
// import shopRoutes from "./routes/shopRoute.js";


// const app = express()

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// //Middleware
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));

// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs')
// app.use(express.static(path.join(__dirname, 'public')));



// app.use((req, res, next) => {
//   res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
//   next();
// });
// //sessions 
// // Setup express-session correctly
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET || "supersecretkey",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: false, // ❗ false if you're using HTTP (localhost)
//       httpOnly: true,
//       sameSite: "lax",
//       maxAge: 24 * 60 * 60 * 1000, // 1 day
//     },
//   })
// );

// app.use(passport.initialize());
// app.use(passport.session());

// connectDB()

// const bags = [
//     { id: 1, name: "Travel Backpack", price: 1999, image: "/images/img.jpg" },
//     { id: 2, name: "Ofiice Laptop Bag", price: 2499, image: "/images/bag2.jpg" },
//     { id: 3, name: "Hiking Rucksack", price: 2799, image: "/images/bag3.jpg" },
    

// ];

// //Routes
// app.use("/user",userRoutes);
// app.use("/auth",userAuthRoutes);
// app.use("/admin",adminRoutes);
// app.use("/admin/users",usersRoutes);
// app.use("/admin/category",categoryRoutes);
// app.use("/admin/products",productRoutes);
// app.use("/", shopRoutes);


// app.get("/test", (req, res) => {
//   res.sendFile(path.join(__dirname, "public/images/img1.png"));
// });
// // app.get("/",(req,res)=>{
// //     const user=req.session.user||null;
// //     res.render("index",{user,bags});
// // });
// app.get('/', (req, res) => {
//   res.render('index');
// })


// const PORT = 3000

// // The server is started in the bootstrap function above
//  app.listen(PORT, () => {
//     console.log(`The server is running on port ${PORT}`);
// });


// import express from "express";
// import session from "express-session";
// import MongoStore from "connect-mongo";
// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";
// import { noCache } from "./middlewares/cacheMiddleware.js"
// import userRoutes from "./routes/userRoutes.js";

// dotenv.config();
// const app = express();
// const __dirname = path.dirname(fileURLToPath(import.meta.url));

// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());

// // ✅ Session store in MongoDB (recommended for production)
// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
//   cookie: {
//     httpOnly: true,
//     maxAge: 1000 * 60 * 30 // 30 min
//   },
// })
// );

// // ✅ Disable cache globally
// app.use((req, res, next) => {
//   res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
//   res.set("Pragma", "no-cache");
//   res.set("Expires", "0");
//   next();
// });

// app.set("view engine", "ejs");
// app.set("views", path.join(__dirname, "views"));


// app.use(noCache);
// app.use("/user", userRoutes);

// app.get('/', (req, res) => {
//   res.render('index');
// })

// app.listen(process.env.PORT || 3000, () =>
//   console.log("Server running on port 3000")
// );

// import dotenv from "dotenv";
// dotenv.config();
// import express from "express";
// import session from "express-session";
// import path from "path";
// import passport from "./config/passport.js";
// import { fileURLToPath } from "url";
// import MongoStore from "connect-mongo";
// import connectDB from "./config/DB.js";
// import userRoutes from "./routes/userRoutes.js";
// import {noCache} from "./middlewares/cacheMiddleware.js"
// import authRoutes from "./routes/authRoutes.js";
// import adminRoutes from "./routes/adminRoutes.js";  

// const app = express();
// const __dirname = path.dirname(fileURLToPath(import.meta.url));


// // ✅ Connect DB BEFORE routes
// connectDB();

// app.set("view engine", "ejs");
// app.set("views",path.join(__dirname, "views"));
// app.use(express.static(path.join(__dirname, "public"))); 


// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());

// app.use(
//   session({
//     secret: process.env.SESSION_SECRET || "supersecretkey",
//     resave: false,
//     saveUninitialized: false,
//     store: MongoStore.create({
//       mongoUrl: process.env.MONGO_URI,
//       ttl: 24 * 60 * 60, // 1 day
//     }),
//     cookie: {
//       httpOnly: true,
//       secure: false, // true if using HTTPS
//       maxAge: 24 * 60 * 60 * 1000, // 1 day
//     },
//   })
// );

// app.use(noCache);

// //passport middleware
// app.use(passport.initialize());
// app.use(passport.session());


// app.use((req, res, next) => {
//   res.locals.currentPage = ''; // Default value (so header never crashes)
//   next();
// });

// app.use("/user", userRoutes);
// app.use("/auth",authRoutes);
//  app.use("/admin",adminRoutes);


// app.get('/', (req, res) => {
//   res.render('index',{currentPage:'home'});
// })

// // ✅ 8. 404 Page
// app.use((req, res) => {
//   res.status(404).render("404", { title: "Page Not Found" });
// });


// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

import dotenv from "dotenv";
dotenv.config();
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import MongoStore from "connect-mongo";
import passport from "./config/passport.js";
import connectDB from "./config/DB.js";

import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { noCache } from "./middlewares/cacheMiddleware.js";
import categoryRoutes from "./routes/admin/categoryRoutes.js";
import productRoutes from "./routes/admin/productRoutes.js";
import usersRoutes from "./routes/admin/usersRoutes.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Connect DB
connectDB();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      ttl: 24 * 60 * 60,
    }),
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(noCache);
app.use(passport.initialize());
app.use(passport.session());

// ✅ Make currentPath available everywhere
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// Routes
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);
app.use("/auth", authRoutes);
app.use("/admin/category", categoryRoutes);
app.use("/admin/products", productRoutes);
app.use("/admin/users", usersRoutes); 

app.get("/", (req, res) => {
  res.render("index", { currentPage: "home" });
});

// 404
app.use((req, res) => {
  res.status(404).render("404", { title: "Page Not Found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
