// // import express from "express";
// // import { showHomePage, signupUser, getsignup, getVerifyOtp, postVerifyOtp, showLandingPage } from "../controllers/user/userController.js";
// // import { renderLogin, loginUser } from "../controllers/user/authController.js";
// // import {
// //   renderForgotPassword,
// //   postForgotPassword,
// //   renderResetPassword,
// //   postResetPassword,
// //   postForgotVerifyOtp,
// //   renderForgotVerifyOtp,
// // } from "../controllers/user/authForgotController.js";
// // import { logoutUser } from "../controllers/user/userController.js";
// // const router = express.Router();


// // router.get("/", showHomePage); // public homepage


// // router.get("/signup", getsignup);
// // router.post("/signup", signupUser);


// // router.get("/verifyOtp", getVerifyOtp);
// // router.post("/verifyOtp", postVerifyOtp);

// // router.get("/landing",showLandingPage)//landing after otp verification

// // router.get("/login",renderLogin);//Render Login Page
// // router.post("/login",loginUser);//Handle login submit

// // router.get("/forgotPassword",renderForgotPassword);
// // router.post("/forgotPassword",postForgotPassword);

// // router.get("/forgotOtp",renderForgotVerifyOtp);
// // router.post("/forgotOtp",postForgotVerifyOtp);

// // router.get("/resetPassword",renderResetPassword);
// // router.post("/resetPassword",postResetPassword);

// // router.get("/logout",logoutUser);





import express from "express";
import {
  getSignup,
  signupUser,
  getVerifyOtp,
  postVerifyOtp,
  resendOtp,
  getLogin,
  loginUser,
  showHomePage,
  logoutUser,
} from "../controllers/user/userController.js";
import { renderForgotPassword, postForgotPassword, renderForgotVerifyOtp, postForgotVerifyOtp, renderResetPassword, postResetPassword } from "../controllers/user/authForgotController.js"; 
import { isUserLoggedIn, isUserLoggedOut, checkBlockedUser } from "../middlewares/userAuth.js";
import { noCache }  from "../middlewares/cacheMiddleware.js";


const router = express.Router();

router.use(noCache);
// Signup
router.get("/signup", isUserLoggedOut, getSignup);
router.post("/signup", signupUser);

// OTP
router.get("/verifyOtp", getVerifyOtp);
router.post("/verifyOtp", postVerifyOtp);

router.get("/resendOtp", resendOtp);


// Login
router.get("/login", isUserLoggedOut, getLogin);
router.post("/login", loginUser);

//forgetpassword
router.get("/forgotPassword",renderForgotPassword);
 router.post("/forgotPassword",postForgotPassword);

// Home
router.get("/home", isUserLoggedIn, checkBlockedUser, showHomePage);

// Logout
router.get("/logout", isUserLoggedIn, logoutUser);

export default router;
