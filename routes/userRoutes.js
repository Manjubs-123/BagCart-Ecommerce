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
import { renderForgotPassword, postForgotPassword, renderForgotVerifyOtp, postForgotVerifyOtp,resendForgotOtp, renderResetPassword, postResetPassword } from "../controllers/user/authForgotController.js"; 
import { isUserLoggedIn, isUserLoggedOut} from "../middlewares/userAuth.js";
import { isAuthenticated } from "../middlewares/passportAuth.js";
import { noCache }  from "../middlewares/cacheMiddleware.js";
import { renderLandingPage ,renderShopPage} from "../controllers/user/productController.js";
import { getProductDetails } from "../controllers/user/shopController.js";  

const router = express.Router();

//Prevent browser caching
router.use(noCache);

//
router.get("/landing",isAuthenticated,renderLandingPage); // landing Page

// --------------------- PUBLIC ROUTES ---------------------
// Signup
router.get("/signup", isUserLoggedOut,getSignup);
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


 //OTP verify
router.get("/forgotOtp",renderForgotVerifyOtp);
router.post("/forgotOtp",postForgotVerifyOtp);

router.get("/resendForgotOtp", resendForgotOtp);

//Reset
router.get("/resetPassword",renderResetPassword);
router.post("/resetPassword",postResetPassword);


//shop
router.get("/shop",isUserLoggedIn,renderShopPage);

// --------------------- PROTECTED ROUTES ---------------------

// Only logged-in & unblocked users can access these
//product details page
router.get("/product/:id",isUserLoggedIn,getProductDetails);

// Home
router.get("/home",isUserLoggedIn, showHomePage);

// Logout
router.get("/logout", isUserLoggedIn, logoutUser);

export default router;
