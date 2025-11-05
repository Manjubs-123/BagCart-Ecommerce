// middlewares/authMiddleware.js

// ✅ 1. Check if the user is logged in
export const isUserLoggedIn = (req, res, next) => {
  if (req.session && req.session.isLoggedIn && req.session.user) {
    // Optional: Block access if user was blocked by admin
    if (req.session.user.isBlocked) {
      req.session.destroy(() => {
        return res.render("user/blocked", {
          title: "Access Denied",
          message: "Your account has been blocked. Please contact support.",
        });
      });
    }
    return next(); // allow access
  }
  // If not logged in → redirect to login page
  return res.redirect("/user/login");
};

// ✅ 2. Restrict access to login/signup pages if user already logged in
export const isUserLoggedOut = (req, res, next) => {
  if (!req.session || !req.session.isLoggedIn) {
    return next(); // allow access to login/signup
  }
  return res.redirect("/user/home"); // already logged in
};

// ✅ 3. Optional Middleware (if admin can block users)
export const checkBlockedUser = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.isBlocked) {
    req.session.destroy(() => {
      res.render("user/blocked", {
        title: "Access Denied",
        message: "Your account has been blocked. Please contact support.",
      });
    });
  } else {
    next();
  }
};
