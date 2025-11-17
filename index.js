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
import {renderHomePage} from "./controllers/user/productController.js";
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


app.use(noCache);
app.use(passport.initialize());
app.use(passport.session());


app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.currentPage = "";
  res.locals.currentPath = req.path;
  next();
});

app.use("/admin", adminRoutes);
app.use("/user", userRoutes);
app.use("/user", shopRoutes);
app.use("/auth", authRoutes);
app.use("/admin/category", categoryRoutes);
app.use("/admin/products", productRoutes);
app.use("/admin/users", usersRoutes); 
app.get("/", renderHomePage);




app.use((req, res) => {
  res.status(404).render("404", { title: "Page Not Found" });
});
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
