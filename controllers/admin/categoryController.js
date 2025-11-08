import Category from "../../models/category.js";

// List categories (with search, pagination)
// export const listCategories = async (req, res) => {
//   try {
//     const page = Math.max(1, parseInt(req.query.page || "1", 10));
//     const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
//     const q = (req.query.q || "").trim();

//     const filter = { isDeleted: false };
//     if (q) {
//       filter.name={$regex:q,$options:"i"}
//     }

//     const total = await Category.countDocuments(filter);
//     const pages = Math.ceil(total / limit);
//     const skip = (page - 1) * limit;

//     const categories = await Category.find(filter)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     res.render("admin/categoryList", { categories, page, pages, limit, q });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server Error");
//   }
// };

export const listCategories = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
    const q = (req.query.q || "").trim();

    // Search + filter setup
    const filter = { isDeleted: false };
    if (q) {
      filter.name = { $regex: q, $options: "i" };
    }

    // Pagination setup
    const totalCategories = await Category.countDocuments(filter);
    const pages = Math.ceil(totalCategories / limit);
    const skip = (page - 1) * limit;

    // Data fetching
    const categories = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Status counts
    const activeCategories = await Category.countDocuments({ isActive: true, isDeleted: false });
    const blockedCategories = await Category.countDocuments({ isActive: false, isDeleted: false });

    // Render the view
    res.render("admin/categoryList", {
      categories,
      totalCategories,
      activeCategories,
      blockedCategories,
      page,
      pages,
      limit,
      q,
    });

  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).send("Server Error");
  }
};

// Render Add Category page
export const renderAddCategory = async (req, res) => {
  try {
    res.render("admin/addCategory"); // Make sure this file exists: views/admin/addCategory.ejs
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Add new category


// export const addCategory = async (req, res) => {
//   try {
//     const { name, description } = req.body;

//     if (!name || name.trim() === "") {
//       return res.redirect("/admin/category/addCategory?error=Name is required");
//     }

//     const existing = await Category.findOne({ 
//       name: name.trim(), 
//       isDeleted: false 
//     });

//     if (existing) {
//       return res.redirect("/admin/category/addCategory?error=Category already exists");
//     }

//     await Category.create({ name: name.trim(), description });
//     res.redirect("/admin/category?success=Category added successfully");
    
//   } catch (err) {
//     console.error(err);
//     res.redirect("/admin/category/addCategory?error=Server error, please try again");
//   }
// };

export const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // 🧩 Basic field validations
    if (!name || name.trim() === "") {
      return res.redirect("/admin/category/addCategory?error=Category name is required");
    }

    if (!description || description.trim().length < 10) {
      return res.redirect("/admin/category/addCategory?error=Description must be at least 10 characters long");
    }

    // 🧠 Case-insensitive duplicate check (ignores isDeleted=true)
    const existing = await Category.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      isDeleted: false
    });

    if (existing) {
      return res.redirect("/admin/category/addCategory?error=Category name already exists");
    }

    // ✅ Create new category
    await Category.create({
      name: name.trim(),
      description: description.trim(),
    });

    // Redirect with success message
    res.redirect("/admin/category?success=Category added successfully");
    
  } catch (err) {
    console.error("Error adding category:", err);
    res.redirect("/admin/category/addCategory?error=Server error, please try again");
  }
};


// Get single category for edit
export const getCategory = async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id).lean();
     if (!cat) {
      return res.status(404).render("admin/404", { message: "Category not found" });
    }
    res.render("admin/editCategory", { category: cat });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const { id } = req.params;

    const existing = await Category.findOne({
      _id: { $ne: id },
      name: name.trim(),
      isDeleted: false,
    });
    if (existing) {
      return res.status(409).send("Category name already exists");
    }

    await Category.findByIdAndUpdate(id, { name: name.trim(), description });
  res.redirect("/admin/category");

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// categoryController.js (Ensure this function is present and correctly exported)

// Toggle block/unblock category (Uses isActive status for temporary block)
export const toggleCategoryStatus = async (req, res, next) => {
  try {
    const { id } = req.query; // Assuming you pass ID via query for AJAX
    // Or: const { id } = req.params; if you use a cleaner route structure

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Toggle the active/block status
    // If isActive is true (Active), set to false (Blocked)
    category.isActive = !category.isActive; // <--- This performs the BLOCK/UNBLOCK
    await category.save();

    return res.status(200).json({
      success: true,
      message: category.isActive ? 'Category unblocked successfully' : 'Category blocked successfully',
      isActive: category.isActive
    });
  } catch (error) {
    next(error);
  }
};
// categoryController.js (Add this function)

// Soft delete category (Mark as isDeleted: true)
export const softDeleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find by ID and update the isDeleted flag
        const result = await Category.findByIdAndUpdate(
            id, 
            { isDeleted: true }, 
            { new: true }
        );

        if (!result) {
            return res.status(404).json({ success: false, message: 'Category not found.' });
        }

        // Send a success response back to the client-side fetch call
        return res.status(200).json({ 
            success: true, 
            message: 'Category soft-deleted successfully.' 
        });
    } catch (error) {
        console.error("Error during soft delete:", error);
        res.status(500).json({ success: false, message: 'Server error during soft delete.' });
    }
};
