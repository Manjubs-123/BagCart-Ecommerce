import dotenv from "dotenv";
dotenv.config();

export const renderAdminLogin = (req, res) => {

  // Prevent caching of login page
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // If already logged in redirect to dashboard
  if (req.session.isAdmin) {
    return res.redirect("/admin/dashboard");
  }

  res.render("admin/login", { error: null });
};


export const postAdminLogin = async (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect("/admin/dashboard");
  } else {
    res.render("admin/login", { error: "Invalid credentials" });
  }
};


export const renderAdminDashboard = (req, res) => {
  res.render("admin/dashboard", { title: "Admin Dashboard" });
};


export const adminLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Session destroy error:", err);
    res.clearCookie("connect.sid");
    res.redirect("/admin"); // redirects to login page
  });
};


