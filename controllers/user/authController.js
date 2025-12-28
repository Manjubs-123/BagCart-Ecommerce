import User from "../../models/userModel.js";

const DEFAULT_URL =
  "https://res.cloudinary.com/db5uwjwdv/image/upload/v1763442856/AdobeStock_1185421594_Preview_cvfm1v.jpg";
const DEFAULT_ID = "AdobeStock_1185421594_Preview_cvfm1v";


export const googleCallbackController = async (req, res) => {
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

    //  Preserve admin session if exists
    const wasAdminLoggedIn = req.session.isAdmin;

 
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      wishlistCount: user.wishlist?.length || 0,
      cartCount: user.cart?.items?.length || 0,
    };

    req.session.isLoggedIn = true;

    // Restore admin session if needed
    if (wasAdminLoggedIn) {
      req.session.isAdmin = true;
    }

    // Remove passport session data
    delete req.session.passport;

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.redirect("/user/login");
      }

      console.log("Session saved successfully:", {
        user: req.session.user?.email,
        isAdmin: req.session.isAdmin,
      });

      res.redirect("/user/landing");
    });

  } catch (error) {
    console.error("Google callback error:", error);
    res.redirect("/user/login");
  }
};

/**
 * Logout Controller
 */
export const logoutController = (req, res) => {
  // Preserve admin session
  const wasAdminLoggedIn = req.session.isAdmin;

  // Clear user session
  req.session.user = null;
  req.session.isLoggedIn = false;

  // Remove passport data
  delete req.session.passport;

  // Restore admin session
  if (wasAdminLoggedIn) {
    req.session.isAdmin = true;
  }

  // Passport logout (safe check)
  if (req.logout) {
    req.logout((err) => {
      if (err) console.error("Passport logout error:", err);
    });
  }

  req.session.save((err) => {
    if (err) console.error("Session save error:", err);
    res.redirect("/user/login");
  });
};
