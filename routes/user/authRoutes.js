import express from "express";
import passport from "passport";
import User from "../../models/userModel.js";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google Callback after login
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/user/login" }),
  async (req, res) => {

    console.log(" Google login successful for:", req.user?.email);


    let existingUser = await User.findOne({ email: req.user.email })
    if(existingUser){
      req.session.user = { id: existingUser._id, name: existingUser.name, email: existingUser.email }
      req.session.isLoggedIn = true
    } else {
     
      console.log("Existing User not found afte google auth")
    }

    // Save session before redirect
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/user/landing"); //  redirect to landing page
    });
  }
);

//  Logout
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect("/user/login"));
  });
});

export default router;
