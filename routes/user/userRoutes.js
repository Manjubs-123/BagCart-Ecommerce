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
  renderUserProfile,
  updateUserProfile,
  getChangeEmailPage,sendChangeEmailOtp,verifyChangedEmailOtp,getAddressPage,addAddress,resendChangeEmailOtp,
  updateAddress,deleteAddress,setDefaultAddress,getSecuritySettings,checkCurrentPassword,changePassword,getWishlistPage,addToWishlist,removeFromWishlist,toggleWishlist,getCheckoutPage
} from "../../controllers/user/userController.js";

import { renderForgotPassword, postForgotPassword, renderForgotVerifyOtp, postForgotVerifyOtp, resendForgotOtp, renderResetPassword, postResetPassword } from "../../controllers/user/authForgotController.js";
import { isUserLoggedIn, isUserLoggedOut } from "../../middlewares/userAuth.js";
import { noCache } from "../../middlewares/cacheMiddleware.js";
import { renderLandingPage } from "../../controllers/user/productController.js";
import { getProductDetails } from "../../controllers/user/shopController.js";
import { isAuthenticated } from "../../middlewares/passportAuth.js";
import profileUpload from "../../middlewares/profileUpload.js";

const router = express.Router();

//Prevent browser caching
router.use(noCache);


router.get("/landing", isUserLoggedIn, isAuthenticated, renderLandingPage); // landing Page

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
router.get("/forgotPassword", renderForgotPassword);
router.post("/forgotPassword", postForgotPassword);


//OTP verify
router.get("/forgotOtp", renderForgotVerifyOtp);
router.post("/forgotOtp", postForgotVerifyOtp);

router.get("/resendForgotOtp", resendForgotOtp);

//Reset
router.get("/resetPassword", renderResetPassword);
router.post("/resetPassword", postResetPassword);

router.get("/product/:id", isUserLoggedIn, getProductDetails);

// // Home
router.get("/home", isUserLoggedIn, showHomePage);


//profile
router.get('/profile',isUserLoggedIn,renderUserProfile);

router.post(
  "/updateProfile",
  profileUpload.single("profileImage"), 
  updateUserProfile
);

router.get("/change-email",isUserLoggedIn,getChangeEmailPage);
router.post("/change-email/send-otp",isUserLoggedIn,sendChangeEmailOtp);
router.post("/change-email/verify",isUserLoggedIn,verifyChangedEmailOtp);

router.get('/profile/addresses',isAuthenticated,getAddressPage)


// create address
router.post("/addresses", isAuthenticated, addAddress);

// update address
router.put("/addresses/:id", isAuthenticated, updateAddress);

// delete address
router.delete("/addresses/:id", isAuthenticated, deleteAddress);

// set default address
router.patch("/addresses/:id/default", isUserLoggedIn, setDefaultAddress);

//security 
router.get('/profile/changepassword',isUserLoggedIn,getSecuritySettings)
router.post("/change-password", isUserLoggedIn, changePassword);
router.post("/change-email/resend-otp",isUserLoggedIn, resendChangeEmailOtp);


router.post("/check-current-password", isUserLoggedIn, checkCurrentPassword);

//wishlist
router.get('/profile/wishlist',isUserLoggedIn, getWishlistPage);
router.post('/wishlist/add/:productId',isUserLoggedIn, addToWishlist);
router.post('/wishlist/remove/:productId',isUserLoggedIn, removeFromWishlist);
router.post("/wishlist/toggle/:productId", toggleWishlist);

//checkout
router.get("/checkout",isUserLoggedIn,getCheckoutPage);



// Logout
router.get("/logout", isUserLoggedIn, logoutUser);

export default router;
