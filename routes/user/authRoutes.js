import express from "express";
import passport from "passport";
import User from "../../models/userModel.js";

const router = express.Router();

const DEFAULT_URL =
  "https://res.cloudinary.com/db5uwjwdv/image/upload/v1763442856/AdobeStock_1185421594_Preview_cvfm1v.jpg";
const DEFAULT_ID = "AdobeStock_1185421594_Preview_cvfm1v";

// Apply Passport middleware ONLY to these routes
const passportMiddleware = [
  passport.initialize(),
  passport.session()
];

router.get(
  "/google",
  passportMiddleware,
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passportMiddleware,
  passport.authenticate("google", { 
    failureRedirect: "/user/login",
    session: false  // Prevent Passport from managing session
  }),
  async (req, res) => {
    console.log("Google login successful for:", req.user?.email);

    try {
      let user = await User.findOne({ email: req.user.email });

      if (!user) {
        console.log("Google user not found in DB.");
        return res.redirect("/user/login");
      }

      // Assign default avatar if missing
      if (!user.profileImage || !user.profileImage.url) {
        user.profileImage = {
          url: DEFAULT_URL,
          public_id: DEFAULT_ID,
        };
        await user.save();
      }

      // CRITICAL FIX: Preserve existing admin session if it exists
      const wasAdminLoggedIn = req.session.isAdmin;

      // Store user data
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        wishlistCount: user.wishlist?.length || 0,
        cartCount: user.cart?.items?.length || 0,
      };

      req.session.isLoggedIn = true;

      // RESTORE admin session if it existed
      if (wasAdminLoggedIn) {
        req.session.isAdmin = true;
      }

      // CRITICAL: Delete any passport session data that might interfere
      delete req.session.passport;

      // Save session explicitly
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect("/user/login");
        }
        console.log("Session saved successfully:", {
          user: req.session.user?.email,
          isAdmin: req.session.isAdmin
        });
        res.redirect("/user/landing");
      });

    } catch (error) {
      console.error("Google callback error:", error);
      res.redirect("/user/login");
    }
  }
);

// Logout
router.get("/logout", (req, res) => {
  // Preserve admin session if exists
  const wasAdminLoggedIn = req.session.isAdmin;
  
  // Clear user session data
  req.session.user = null;
  req.session.isLoggedIn = false;
  
  // Delete passport data
  delete req.session.passport;
  
  // Restore admin session
  if (wasAdminLoggedIn) {
    req.session.isAdmin = true;
  }
  
  // Logout from Passport if needed
  if (req.logout) {
    req.logout((err) => {
      if (err) console.error("Passport logout error:", err);
    });
  }
  
  req.session.save((err) => {
    if (err) console.error("Session save error:", err);
    res.redirect("/user/login");
  });
});

export default router;