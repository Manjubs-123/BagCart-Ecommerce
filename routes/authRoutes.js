// import express from "express";
// import passport from "passport";

// const router=express.Router();

// //step1:Redirect to login page
// router.get("/google",
//     passport.authenticate("google",{scope:["profile","email"]})
// );
 

// //Google callback route

// router.get("/google/callback",
//     passport.authenticate("google",{failureRedirect:"/user/login"}),
//     (req,res)=>{
//         res.redirect("/user/landing");
//     }
// );

// //Logout route
// router.get("/logout",(req,res)=>{
//     req.logout(()=>{
//         res.redirect("/user/login");
//     });
// });
// export default router;

import express from "express";
import passport from "passport";

const router = express.Router();

// Step 1: Login with Google
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Step 2: Callback after Google login
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/user/login" }),
  (req, res) => {
    // Successful login
    res.redirect("/user/home");
  }
);

export default router;



