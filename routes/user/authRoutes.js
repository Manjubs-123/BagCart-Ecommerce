

import express from "express";
import passport from "passport";
import User from "../../models/userModel.js";

const router = express.Router();

// Default avatar details
const DEFAULT_URL =
  "https://res.cloudinary.com/db5uwjwdv/image/upload/v1763442856/AdobeStock_1185421594_Preview_cvfm1v.jpg";
const DEFAULT_ID = "AdobeStock_1185421594_Preview_cvfm1v";

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google Callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/user/login" }),
  async (req, res) => {
    console.log("Google login successful for:", req.user?.email);

    let user = await User.findOne({ email: req.user.email });

    if (user) {

      // FIX: Assign default avatar if missing
      if (!user.profileImage || !user.profileImage.url) {
        user.profileImage = {
          url: DEFAULT_URL,
          public_id: DEFAULT_ID,
        };
        await user.save();
      }

      // Store fresh data into session
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,  
        wishlistCount: user.wishlist?.length || 0,
        cartCount: user.cart?.items?.length || 0,
      };

      req.session.isLoggedIn = true;

    } else {
      console.log("Google user not found in DB.");
    }

    // Save session before redirecting
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/user/landing");
    });
  }
);

// Logout
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect("/user/login"));
  });
});

export default router;

