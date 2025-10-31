// controllers/admin/userController.js
import User from "../../models/userModel.js";

// Display all users with search, pagination, and sorting
export const getUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
        const q = (req.query.q || "").trim(); // Get search query

        // Build the filter object
        const filter = {};
        if (q) {
            filter.$or = [
                { name: { $regex: q, $options: "i" } },
                { email: { $regex: q, $options: "i" } },
            ];
        }

        const total = await User.countDocuments(filter);
        const pages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;

        const users = await User.find(filter)
            .sort({ createdAt: -1 }) // Sorted in descending order (latest first)
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean() for better performance

        res.render("admin/users", { 
            users, 
            page, 
            pages, 
            limit, 
            q, 
            total 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

// Toggle block/unblock (Returns JSON for SweetAlert2)
export const toggleBlockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        const message = user.isBlocked ? "User blocked successfully." : "User unblocked successfully.";

        return res.status(200).json({ success: true, message: message });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};