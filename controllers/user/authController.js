import bcrypt from "bcryptjs";
import User from "../../models/userModel.js";

// Render login page
export const renderLogin = (req, res) => {
  res.render("user/login", {error: null });
};

// Handle login form submission
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  

  try {
    //  Check if email exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.render("user/login", {
        error: "Email not registered. Please signup first.",
      });
    }

    //  Check if email is verified
    if (!user.isVerified) {
      return res.render("user/login", {
        error: "Please verify your email before logging in.",
      });
    }

    //  Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("user/login", {
        error: "Incorrect password. Please try again.",
      });
    }

    //  Success: create session and redirect
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
    };
    res.redirect("/user/landing");

  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).render("user/login", {
      error: "Something went wrong. Please try again later.",
    });
  }
};
