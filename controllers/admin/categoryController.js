import Category from "../../models/category.js";

export const listCategories = async (req, res) => {
  try {
    const escapeRegex = (text = "") =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
   const q = (req.query.q || "").trim();
const safeQ = escapeRegex(q);

const filter = q
  ? {
      $or: [
        { name: { $regex: safeQ, $options: "i" } },
        { email: { $regex: safeQ, $options: "i" } },
      ],
    }
  : {};


    // Total filtered categories count
    const totalCategories = await Category.countDocuments(filter);

    const pages = Math.ceil(totalCategories / limit);
    const skip = (page - 1) * limit;

    const categories = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Status counts
    const activeCategories = await Category.countDocuments({ isActive: true, isDeleted: false });
    const blockedCategories = await Category.countDocuments({ isActive: false, isDeleted: false });

    res.render("admin/categoryList", {
      categories,
      totalCategories,
      activeCategories,
      blockedCategories,
      page,
      pages,
      limit,
      q
    });

  } catch (err) {
    console.error("Category Fetch Error:", err);
    res.status(500).send("Server Error");
  }
};


// Render Add Category page
export const renderAddCategory = async (req, res) => {
  try {
    res.render("admin/addCategory"); 
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Add new category


export const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
      return res.redirect("/admin/category/addCategory?error=Category name is required");
    }

    if (!description || description.trim().length < 10) {
      return res.redirect("/admin/category/addCategory?error=Description must be at least 10 characters long");
    }

    //  Case-insensitive duplicate check
    const existing = await Category.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      isDeleted: false
    });

    if (existing) {
      return res.redirect("/admin/category/addCategory?error=Category name already exists");
    }

    // Create new category
    await Category.create({
      name: name.trim(),
      description: description.trim(),
    });

    res.redirect("/admin/category?success=Category added successfully");
    
  } catch (err) {
    console.error("Error adding category:", err);
    res.redirect("/admin/category/addCategory?error=Server error, please try again");
  }
};



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
      name: {$regex:`^${name.trim()}$`,$options:"i"},
      isDeleted: false,
    });
    if (existing) {
      return res.status(400).json({success:false,message:"Category name already exists"});

    }

    await Category.findByIdAndUpdate(id, { name: name.trim(), description:description.trim()});
    return res.status(200).json({success:true});

  } catch (err) {
    console.error(err);
   return res.status(500).json({error:"Server Error"});
  }
};

export const toggleCategoryStatus = async (req, res, next) => {
  try {
    const { id } = req.query; 

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Toggle the active/block status
    category.isActive = !category.isActive; 
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

        return res.status(200).json({ 
            success: true, 
            message: 'Category soft-deleted successfully.' 
        });
    } catch (error) {
        console.error("Error during soft delete:", error);
        res.status(500).json({ success: false, message: 'Server error during soft delete.' });
    }
};
