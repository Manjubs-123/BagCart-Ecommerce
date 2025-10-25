import express from "express";
import { showHomePage, signupUser, getsignup, getVerifyOtp, postVerifyOtp, showLandingPage } from "../controllers/user/userController.js";
import { renderLogin, loginUser } from "../controllers/user/authController.js";
import {
  renderForgotPassword,
  postForgotPassword,
  renderResetPassword,
  postResetPassword,
  postForgotVerifyOtp,
  renderForgotVerifyOtp,
} from "../controllers/user/authForgotController.js";
import { logoutUser } from "../controllers/user/userController.js";
const router = express.Router();


router.get("/", showHomePage); // public homepage


router.get("/signup", getsignup);
router.post("/signup", signupUser);


router.get("/verifyOtp", getVerifyOtp);
router.post("/verifyOtp", postVerifyOtp);

router.get("/landing",showLandingPage)//landing after otp verification

router.get("/login",renderLogin);//Render Login Page
router.post("/login",loginUser);//Handle login submit

router.get("/forgotPassword",renderForgotPassword);
router.post("/forgotPassword",postForgotPassword);

router.get("/forgotOtp",renderForgotVerifyOtp);
router.post("/forgotOtp",postForgotVerifyOtp);

router.get("/resetPassword",renderResetPassword);
router.post("/resetPassword",postResetPassword);

router.get("/logout",logoutUser);



export default router;