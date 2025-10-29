import Product from "../../models/productModel.js";
import Category from "../../models/category.js";
import { cloudinary } from "../../config/cloudinary.js";
import fs from 'fs/promises';

// Render Add Product page
export const renderAddProduct = async (req, res) => {
  try {
    const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();
    // Simple color list - adjust as needed
    const colors = [
      'Black','Blue','Brown','Gray','Red','Green','Yellow','White','Pink','Purple','Orange'
    ];

    return res.render('admin/addProduct', {
      title: 'Add Product',
      categories,
      colors
    });
  } catch (error) {
    console.error('Render Add Product Error:', error);
    return res.status(500).send('Failed to render add product page');
  }
};
  
// Get all products (excluding soft deleted)
export const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '' } = req.query;

    const query = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    const skip = (page - 1) * limit;

    const [rawProducts, total] = await Promise.all([
      Product.find(query)
        .populate({ path: 'category', match: { isActive: true, isDeleted: false } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query)
    ]);

    // Filter out products whose category was filtered out by populate (blocked/deleted categories)
    const products = rawProducts.filter(p => p.category != null);

    // 👇 Render EJS view instead of returning JSON
    res.render("admin/productList", {
      products,
      q: search,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get Products Error:', error);
    res.status(500).send("Failed to load products");
  }
};


// Get single product by ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findOne({ 
      _id: id,  
      isDeleted: false 
    }).populate('category');
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }
    
    res.json({ success: true, product });
  } catch (error) {
    console.error('Get Product Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch product',
      error: error.message 
    });
  }
};

// Get active categories (not blocked)
export const getActiveCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true, isDeleted: false })
      .select('name description')
      .sort({ name: 1 })
      .lean();
      
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Get Categories Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch categories',
      error: error.message 
    });
  }
};

// export const addProduct = async (req, res) => {
//   try {
//     const { name, description, brand, category, variants } = req.body;

//     // Validate basic information
//     if (!name?.trim()) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Product name is required' 
//       });
//     }

//     if (!description?.trim()) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Description is required' 
//       });
//     }

//     if (!brand?.trim()) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Brand is required' 
//       });
//     }

//     if (!category) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Category is required' 
//       });
//     }

//     // Check if category exists and is not blocked
//     const categoryDoc = await Category.findById(category);
//     if (!categoryDoc) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Category not found' 
//       });
//     }
    
//     if (categoryDoc.isBlocked) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'This category is blocked and cannot be used' 
//       });
//     }

//     // Validate variants
//     if (!variants || !Array.isArray(variants) || variants.length === 0) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'At least one variant is required' 
//       });
//     }

//     // Validate each variant
//     for (let i = 0; i < variants.length; i++) {
//       const variant = variants[i];
      
//       if (!variant.color?.trim()) {
//         return res.status(400).json({ 
//           success: false, 
//           message: `Variant ${i + 1}: Color is required` 
//         });
//       }

//       const price = parseFloat(variant.price);
//       if (isNaN(price) || price < 0) {
//         return res.status(400).json({ 
//           success: false, 
//           message: `Variant ${i + 1}: Price must be a positive number` 
//         });
//       }

//       const stock = parseInt(variant.stock);
//       if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
//         return res.status(400).json({ 
//           success: false,   
//           message: `Variant ${i + 1}: Stock must be a positive integer` 
//         });
//       }

//       if (!variant.images || !Array.isArray(variant.images) || variant.images.length < 3) {
//         return res.status(400).json({ 
//           success: false, 
//           message: `Variant ${i + 1}: At least 3 images are required` 
//         });
//       }

//       // Validate image objects
//       for (let j = 0; j < variant.images.length; j++) {
//         if (!variant.images[j].url || !variant.images[j].publicId) {
//           return res.status(400).json({ 
//             success: false, 
//             message: `Variant ${i + 1}, Image ${j + 1}: Invalid image data` 
//           });
//         }
//       }
//     }

//     // Create product
//     const product = new Product({
//       name: name.trim(),
//       description: description.trim(),
//       brand: brand.trim(),
//       category,
//       variants: variants.map(v => ({
//         color: v.color.trim(),
//         price: parseFloat(v.price),
//         stock: parseInt(v.stock),
//         images: v.images
//       }))
//     });

//     await product.save();
//     await product.populate('category');

//     res.status(201).json({ 
//       success: true, 
//       message: 'Product added successfully', 
//       product 
//     });
//   } catch (error) {
//     console.error('Add Product Error:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Failed to add product',
//       error: error.message 
//     });
//   }
// };

// Update product

export const addProduct = async (req, res) => {
  try {
    console.log("Incoming body:", req.body);
    console.log("Incoming files:", req.files);

    let { name, description, brand, category, variants } = req.body;

    // Parse variants if sent as a JSON string (common in FormData)
    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants);
      } catch (err) {
        console.error("Failed to parse variants JSON:", err);
        variants = [];
      }
    }

    // If variants not provided, try reconstructing manually
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      const variantKeys = Object.keys(req.body).filter(k => k.startsWith("variants["));
      const variantIndexes = [...new Set(variantKeys.map(k => k.match(/variants\[(\d+)\]/)?.[1]))];
      variants = [];

      for (const i of variantIndexes) {
        const color = req.body[`variants[${i}][color]`];
        const price = req.body[`variants[${i}][price]`];
        const stock = req.body[`variants[${i}][stock]`];
        const images = req.files
          .filter(f => f.originalname.startsWith(`variant${i}_`))
          .map(f => f.path);

        if (color && price && stock && images.length > 0) {
          variants.push({ color, price, stock, images });
        }
      }
    }

    if (!name || !description || !brand || !category)
      return res.status(400).json({ message: "Missing required fields" });

    if (!variants || variants.length === 0)
      return res.status(400).json({ message: "At least one variant is required" });

    // Create product
    const newProduct = new Product({
      name,
      description,
      brand,
      category,
      variants
    });

    await newProduct.save();

    res.status(201).json({
      message: "Product added successfully",
      product: newProduct
    });
  } catch (error) {
    console.error("Add product error:", error);
    res.status(500).json({
      message: "Failed to add product",
      error: error.message
    });
  }
};


export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, brand, category, variants } = req.body;

    const product = await Product.findOne({ _id: id, isDeleted: false });
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Validate category if provided
    if (category) {
      const categoryDoc = await Category.findById(category);
      if (!categoryDoc) {
        return res.status(400).json({ 
          success: false, 
          message: 'Category not found' 
        });
      }
      
      if (categoryDoc.isBlocked) {
        return res.status(400).json({ 
          success: false, 
          message: 'This category is blocked and cannot be used' 
        });
      }
    }

    // Validate variants if provided
    if (variants) {
      if (!Array.isArray(variants) || variants.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'At least one variant is required' 
        });
      }

      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        
        if (variant.color && !variant.color.trim()) {
          return res.status(400).json({ 
            success: false, 
            message: `Variant ${i + 1}: Color cannot be empty` 
          });
        }

        if (variant.price !== undefined) {
          const price = parseFloat(variant.price);
          if (isNaN(price) || price < 0) {
            return res.status(400).json({ 
              success: false, 
              message: `Variant ${i + 1}: Price must be a positive number` 
            });
          }
        }

        if (variant.stock !== undefined) {
          const stock = parseInt(variant.stock);
          if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
            return res.status(400).json({ 
              success: false, 
              message: `Variant ${i + 1}: Stock must be a positive integer` 
            });
          }
        }

        if (variant.images && variant.images.length < 3) {
          return res.status(400).json({ 
            success: false, 
            message: `Variant ${i + 1}: At least 3 images are required` 
          });
        }
      }
    }

    // Update fields
    if (name?.trim()) product.name = name.trim();
    if (description?.trim()) product.description = description.trim();
    if (brand?.trim()) product.brand = brand.trim();
    if (category) product.category = category;
    if (variants) {
      product.variants = variants.map(v => ({
        color: v.color?.trim() || v.color,
        price: v.price !== undefined ? parseFloat(v.price) : v.price,
        stock: v.stock !== undefined ? parseInt(v.stock) : v.stock,
        images: v.images || []
      }));
    }

    await product.save();
    await product.populate('category');

    res.json({ 
      success: true, 
      message: 'Product updated successfully', 
      product 
    });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update product',
      error: error.message 
    });
  }
};

// Soft delete product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({ _id: id, isDeleted: false });
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    product.isDeleted = true;
    await product.save();

    res.json({ 
      success: true, 
      message: 'Product deleted successfully' 
    });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete product',
      error: error.message 
    });
  }
};

// Upload image to Cloudinary
// export const uploadImage = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'No image file provided' 
//       });
//     }

//     // Upload to Cloudinary
//     const result = await cloudinary.uploader.upload(req.file.path, {
//       folder: 'ecommerce/products',
//       transformation: [
//         { width: 800, height: 800, crop: 'fill', gravity: 'auto' },
//         { quality: 'auto:good' },
//         { fetch_format: 'auto' }
//       ]
//     });

//     // Delete temporary file
//     await fs.unlink(req.file.path);

//     res.json({
//       success: true,
//       message: 'Image uploaded successfully',
//       image: {
//         url: result.secure_url,
//         publicId: result.public_id
//       }
//     });
//   } catch (error) {
//     // Clean up file if upload fails
//     if (req.file?.path) {
//       try {
//         await fs.unlink(req.file.path);
//       } catch (unlinkError) {
//         console.error('Error deleting temp file:', unlinkError);
//       }
//     }
    
//     console.error('Upload Image Error:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Failed to upload image',
//       error: error.message 
//     });
//   }
// };

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }
    res.status(200).json({
      message: "Image uploaded successfully",
      url: req.file.path,
      publicId: req.file.filename
    });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};


// Delete image from Cloudinary
export const deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;
    
    if (!publicId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Public ID is required' 
      });
    }

    await cloudinary.uploader.destroy(publicId);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Delete Image Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete image',
      error: error.message 
    });
  }
};
