// import dotenv from "dotenv";
// dotenv.config();
// export const renderAdminLogin = (req, res) => {
//   // If admin is already logged in, redirect to dashboard instead of login page
//   if (req.session && req.session.isAdmin) {
//     return res.redirect("/admin/dashboard");
//   }
//   res.render("admin/login", { error: null });
// };

// export const postAdminLogin = (req, res) => {
//   const { email, password } = req.body;

//   if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
//     req.session.isAdmin = true;
//     req.session.adminEmail = email;
//     console.log("✅ Admin logged in:", email);
//     return res.redirect("/admin/dashboard");
//   } else {
//     return res.render("admin/login", { error: "Invalid credentials" });
//   }
// };

// export const renderAdminDashboard = (req, res) => {
//   res.render("admin/dashboard", { admin: req.session.adminEmail });
// };

// export const adminLogout = (req, res) => {
//   req.session.destroy((err) => {
//     if (err) console.error("Session destroy error:", err);
//     res.clearCookie("connect.sid");
//     res.redirect("/admin");
//   });
// };


export const renderAdminLogin = (req, res) => {
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

// export const adminLogout = (req, res, next) => {
//   if (req.session) {
//     req.session.destroy((err) => {
//       if (err) {
//         console.error("❌ Error destroying session:", err);
//         return next(err);
//       }
//       res.clearCookie("connect.sid", {
//         path: "/",        // ensure root-level cookie is cleared
//       });
//       console.log("✅ Admin logged out successfully");
//       return res.redirect("/admin");
//     });
//   } else {
//     return res.redirect("/admin");
//   }
// };


// controllers/admin/adminController.js

export const adminLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Session destroy error:", err);
    res.clearCookie("connect.sid");
    res.redirect("/admin"); // redirects to login page
  });
};

