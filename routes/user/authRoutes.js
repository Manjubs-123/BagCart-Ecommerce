import express from "express";
import passport from "passport";
import {
  googleCallbackController,
  logoutController,
} from "../../controllers/user/authController.js";

const router = express.Router();

// Apply Passport middleware ONLY for Google routes
const passportMiddleware = [
  passport.initialize(),
  passport.session(),
];

// Google Login
router.get(
  "/google",
  passportMiddleware,
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google Callback
router.get(
  "/google/callback",
  passportMiddleware,
  passport.authenticate("google", {
    failureRedirect: "/user/login",
    session: false, // IMPORTANT: we manage session manually
  }),
  googleCallbackController
);

// Logout
router.get("/logout", logoutController);

export default router;
