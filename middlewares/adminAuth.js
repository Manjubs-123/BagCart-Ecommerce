// export const isAdminAuthenticated=(req,res,next)=>{
//     if(req.session&&req.session.isAdmin){
//         return next();
//     }else{
//         return res.redirect("/admin")
//     }
// };

// export const isAdminAuthenticated = (req, res, next) => {
//   if (req.session && req.session.isAdmin) {
//     return next();
//   } else {
//     return res.redirect("/admin");
//   }
// };

// middlewares/adminAuth.js
// export const isAdminAuthenticated = (req, res, next) => {
//   if (req.session && req.session.isAdmin) {
//     // ✅ Prevent browser from caching admin pages
//     res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
//     res.setHeader("Pragma", "no-cache");
//     res.setHeader("Expires", "0");
//     next();
//   } else {
//     // If not logged in, redirect to login
//     res.redirect("/admin");
//   }
// };

// middlewares/adminAuth.js
export const isAdminAuthenticated = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    // Prevent caching
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return next();
  }

  // // Detect if it's a fetch / AJAX request
  // const isAjaxRequest =
  //   req.xhr ||
  //   (req.headers.accept && req.headers.accept.includes("json"));

  // if (isAjaxRequest) {
  //   return res
  //     .status(401)
  //     .json({ success: false, message: "Admin session expired. Please log in again." });
  // }

  // Normal browser navigation → redirect
  return res.redirect("/admin");
};



