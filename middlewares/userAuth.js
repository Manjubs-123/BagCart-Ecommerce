
import User from "../models/userModel.js";

//   Check if user is logged in and not blocked
export const isUserLoggedIn = async (req, res, next) => {
  try {


    // console.log("Middleware", req.session)
   

    if (!req.session || !req.session.isLoggedIn || !req.session.user) {
      return res.redirect("/user/login");
    }

   
    const user = await User.findById(req.session.user.id);

    if (!user) {
      req.session.destroy(() => res.redirect("/user/login"));
      return;
    }

    //If user blocked 
   if (user.isBlocked) {
  req.session.isBlocked = true; // store reason BEFORE destroy

  req.session.save(() => {
    req.session.destroy(() => {
      res.redirect("/user/login?blocked=true");
    });
  });
  return;
}

    // Keep user in req for convenience
    req.user = user;
    // console.log("USER:", req.user);

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.redirect("/user/login");
  }
};

//   Restrict access to login/signup pages if already logged in
export const isUserLoggedOut = (req, res, next) => {
  if (!req.session || !req.session.isLoggedIn) {
    return next();
  }
  res.redirect("/user/home");
};

