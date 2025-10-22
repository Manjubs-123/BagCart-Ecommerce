import dotenv from "dotenv";
dotenv.config(); 
import express from 'express'
import path from 'path';

import { fileURLToPath } from 'url';
import session  from 'express-session';
import passport from 'passport';
import mongoose from 'mongoose';
import userRoutes from "./routes/userRoutes.js"
// import "./config/passport.js";


const app = express()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')));



//sessions 
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:false
}));

// app.use(passport.initialize());
// app.use(passport.session());



//MongoDB connect
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

const bags = [
    { id: 1, name: "Travel Backpack", price: 1999, image: "/images/bag1.jpg" },
    { id: 2, name: "Ofiice Laptop Bag", price: 2499, image: "/images/bag2.jpg" },
    { id: 3, name: "Hiking Rucksack", price: 2799, image: "/images/bag3.jpg" },
    

];

//Routes
app.use("/user",userRoutes);

// app.get("/",(req,res)=>{
//     const user=req.session.user||null;
//     res.render("index",{user,bags});
// });
app.get("/", (req, res) => {
  const user = req.session.user || null;
  res.render("index", { user, bags });
});



const PORT = 3000

app.listen(PORT, () => {
    console.log("The server is running on port ", PORT)
})
 