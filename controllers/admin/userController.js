
import User from "../../models/userModel.js";


export const getUsers = async (req, res) => {
  try {

    const escapeRegex = (text = "") =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
 

    const q = (req.query.q || "").trim();
const safeQ = escapeRegex(q);

const filter = safeQ
  ? {
      $or: [
        { name: { $regex: safeQ, $options: "i" } },
        { email: { $regex: safeQ, $options: "i" } },
      ],
    }
  : {};


      const totalUsers = await User.countDocuments({});
const activeUsers = await User.countDocuments({ isBlocked: false });
const blockedUsers = await User.countDocuments({ isBlocked: true });

    const total = await User.countDocuments(filter);
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

   res.render("admin/users", {
  users,
  page,
  pages,
  limit,
  q,
  total,
  totalUsers,
  activeUsers,
  blockedUsers
});

  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).send("Server Error");
  }
};

export const toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    return res.json({
      success: true,
      message: user.isBlocked
        ? "User blocked successfully."
        : "User unblocked successfully.",
      newStatus: user.isBlocked,
    });
  } catch (err) {
    console.error("Toggle block error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};