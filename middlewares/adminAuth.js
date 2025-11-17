
export const isAdminAuthenticated = (req, res, next) => {
  if (req.session && req.session.isAdmin===true) {
   
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return next();
  }
  return res.redirect("/admin");
};




export const blockUserWhenAdminLogged = (req, res, next) => {
  if (req.session.isAdmin === true) {
    return res.redirect("/admin/dashboard");
  }
  next();
};
