
import User from "../models/userModel.js";

//  1. Check if user is logged in and not blocked
export const isUserLoggedIn = async (req, res, next) => {
  try {


    console.log("Middleware", req.session)
   

    if (!req.session || !req.session.isLoggedIn || !req.session.user) {
      return res.redirect("/user/login");
    }

    // Always verify from DB (important for dynamic blocking)
    const user = await User.findById(req.session.user.id);

    if (!user) {
      req.session.destroy(() => res.redirect("/user/login"));
      return;
    }

    //If user blocked → destroy session & redirect with query
    if (user.isBlocked) {
      req.session.destroy(() => {
        res.redirect("/user/login?blocked=true");
      });
      return;
    }

    // Keep user in req for convenience
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.redirect("/user/login");
  }
};

//  2. Restrict access to login/signup pages if already logged in
export const isUserLoggedOut = (req, res, next) => {
  if (!req.session || !req.session.isLoggedIn) {
    return next();
  }
  res.redirect("/user/home");
};

// //  3. Optional standalone blocker (for specific routes if needed)
// export const checkBlockedUser = async (req, res, next) => {
//   try {
//     if (!req.session.user) return res.redirect("/user/login");

//     const user = await User.findById(req.session.user.id);
//     if (user?.isBlocked) {
//       req.session.destroy(() => {
//         res.render("user/blocked", {
//           title: "Access Denied",
//           message: "Your account has been blocked. Please contact support.",
//         });
//       });
//       return;
//     }

//     next();
//   } catch (err) {
//     console.error("Blocked user check error:", err);
//     res.redirect("/user/login");
//   }
// };
