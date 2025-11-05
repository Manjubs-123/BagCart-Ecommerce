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
export const isAdminAuthenticated = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    // ✅ Prevent browser from caching admin pages
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  } else {
    // If not logged in, redirect to login
    res.redirect("/admin");
  }
};
