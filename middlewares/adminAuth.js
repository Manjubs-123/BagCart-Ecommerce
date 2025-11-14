
export const isAdminAuthenticated = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    // Prevent caching
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return next();
  }
  return res.redirect("/admin");
};



