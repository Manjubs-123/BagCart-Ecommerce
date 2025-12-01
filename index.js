import dotenv from "dotenv";
dotenv.config();
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import MongoStore from "connect-mongo";
import methodOverride from "method-override";
import passport from "./config/passport.js";
import connectDB from "./config/DB.js";
import userRoutes from "./routes/user/userRoutes.js";
import authRoutes from "./routes/user/authRoutes.js";
import adminRoutes from "./routes/admin/adminRoutes.js";
import { noCache } from "./middlewares/cacheMiddleware.js";
import categoryRoutes from "./routes/admin/categoryRoutes.js";
import productRoutes from "./routes/admin/productRoutes.js";
import usersRoutes from "./routes/admin/usersRoutes.js";
import shopRoutes from "./routes/user/shopRoute.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import User from "./models/userModel.js"
import {renderHomePage} from "./controllers/user/productController.js";
import cartRoutes from "./routes/user/cartRoutes.js"
import userApiRoutes from './routes/user/userApiRoutes.js';
import orderRoutes from './routes/user/orderRoutes.js'
import adminOrderRoutes from "./routes/admin/adminOrderRoutes.js"
import walletRoutes from "./routes/user/walletRoutes.js";
import adminCouponRoutes from "./routes/admin/adminCouponRoutes.js"
import couponRoutes from "./routes/user/couponRoutes.js";
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));


connectDB();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(methodOverride("_method"));


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      ttl: 24 * 60 * 60, // 1 day
    }),
    cookie: {
      httpOnly: true,
      secure: false, //  false for localhost (true only in HTTPS)
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(async (req, res, next) => {
  try {
    if (req.session.user && req.session.user.id) {
      const dbUser = await User.findById(req.session.user.id).lean();

      res.locals.user = dbUser;

      // Also update session user (so it always stays fresh)
      req.session.user = {
        id: dbUser._id,
        name: dbUser.name,
        email: dbUser.email,
        profileImage: dbUser.profileImage, 
        wishlistCount: dbUser.wishlist?.length || 0,
        cartCount: dbUser.cart?.items?.length || 0
      };

    } else {
      res.locals.user = null;
    }
    next();
  } catch (err) {
    console.log("User Load Error:", err);
    res.locals.user = null;
    next();
  }
});

app.use(noCache);

app.use(async (req, res, next) => {
  if (req.session.user && req.session.user.id) {
    let user = await User.findById(req.session.user.id).lean();

    // FIX: if profileImage missing → assign default
    if (!user.profileImage || !user.profileImage.url) {
      user.profileImage = {
        url: "https://res.cloudinary.com/db5uwjwdv/image/upload/v1763442856/AdobeStock_1185421594_Preview_cvfm1v.jpg",
        public_id: "AdobeStock_1185421594_Preview_cvfm1v"
      };

      await User.findByIdAndUpdate(req.session.user.id, {
        profileImage: user.profileImage
      });
    }

    res.locals.user = user;
  } else {
    res.locals.user = null;
  }

  next();
});


app.use(passport.initialize());
app.use(passport.session());


// app.use((req, res, next) => {
//   res.locals.user = req.user || null;
//   res.locals.currentPage = "";
//   res.locals.currentPath = req.path;
//   next();
// });


app.use('/user/cart',cartRoutes);
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);
app.use("/user", shopRoutes);
app.use("/auth", authRoutes);
app.use("/admin/category", categoryRoutes);
app.use("/admin/products", productRoutes);
app.use("/admin/users", usersRoutes); 
app.get("/", renderHomePage);
app.use("/api", userApiRoutes);
app.use('/order',orderRoutes);
app.use('/admin/orders',adminOrderRoutes)
app.use('/user',walletRoutes)
app.use('/admin/coupon', adminCouponRoutes);
app.use('/user', couponRoutes);

// 404 handler



app.use((req, res) => {
  res.status(404).render("404", { title: "Page Not Found" });
});
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
