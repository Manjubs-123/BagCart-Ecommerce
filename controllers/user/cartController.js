import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import { applyOfferToProduct } from "../../utils/applyOffer.js"; 

// export const getCartPage = async (req, res) => {
//   try {
//     if (!req.session.user) {
//       return res.redirect("/user/login");
//     }

//     const userId = req.session.user.id;

//     //  Fetch cart
//     const cart = await Cart.findOne({ user: userId })
//       .populate("items.product");   

//     const ordersCount = 0;
//     const wishlistCount = req.session.user.wishlistCount || 0;
//     const unreadNotifications = 0;

//     res.render("user/cart", {
//       title: "Shopping Cart",
//       currentPage: "cart",
//       user: req.session.user,
//       ordersCount,
//       wishlistCount,
//       unreadNotifications,
//       cart: cart || { items: [] }
//     });

//   } catch (error) {
//     console.error("Cart Page Error:", error);
//     res.status(500).send("Error loading cart page");
//   }
// };



export const getCartPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/user/login");
    }

    const userId = req.session.user.id;

    let cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .lean();

    const ordersCount = 0;
    const wishlistCount = req.session.user.wishlistCount || 0;
    const unreadNotifications = 0;

    if (!cart) {
      return res.render("user/cart", {
        title: "Shopping Cart",
        currentPage: "cart",
        user: req.session.user,
        ordersCount,
        wishlistCount,
        unreadNotifications,
        cart: { items: [] }
      });
    }

    // --------------------------------------------------------
    // 🔥 APPLY OFFER PRICING TO EACH CART ITEM
    // --------------------------------------------------------
    for (let item of cart.items) {
      const product = item.product;
      const variant = product.variants[item.variantIndex];

      const offerData = await applyOfferToProduct({
        ...product,
        variants: [variant] // apply only to selected variant
      });

      const offerVariant = offerData.variants[0];

      item.finalPrice = offerVariant.finalPrice;           // discounted
      item.regularPrice = offerVariant.regularPrice;       // MRP
      item.appliedOffer = offerVariant.appliedOffer;       // offer name, etc.
      item.totalPrice = offerVariant.finalPrice * item.quantity;
    }

    // Render page with updated items
    return res.render("user/cart", {
      title: "Shopping Cart",
      currentPage: "cart",
      user: req.session.user,
      ordersCount,
      wishlistCount,
      unreadNotifications,
      cart
    });

  } catch (error) {
    console.error("Cart Page Error:", error);
    res.status(500).send("Error loading cart page");
  }
};



export const addToCart = async (req, res) => {
  try {
    const { productId, quantity, variantIndex } = req.body;
    const userId = req.session.user.id;

    console.log("SESSION USER:", req.session.user);
    console.log("UserID:", req.session.user?.id);

    // V.... product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }

    // V.. variant index
    if (variantIndex === undefined || variantIndex < 0 || variantIndex >= product.variants.length) {
      return res.json({ success: false, message: "Invalid variant selection" });
    }
    // Check stock
    const variant = product.variants[variantIndex];
    if (variant.stock < quantity) {
      return res.json({ success: false, message: "Not enough stock" });
    }

    // Find user cart
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: []
      });
    }

    //fix old cart
    cart.items = cart.items.map(i => {
      if (i.variantIndex === undefined) {
        i.variantIndex = 0;   
      }
      return i;
    });

    //  Check  same product and variant already exists
    const existingItem = cart.items.find(
      item =>
        item.product.toString() === productId &&
        item.variantIndex === variantIndex
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;

      if (newQuantity > variant.stock) {
        return res.json({
          success: false,
          message: "Cannot add more, stock limit reached"
        });
      }

      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        variantIndex
      });
    }
 
    await cart.save();

    return res.json({ success: true, message: "Item added to cart" });

  } catch (err) {
    console.error("Add to Cart Error:", err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};


export const updateCartQuantity = async (req, res) => {
  try {
    const itemId = req.params.id;              
    const { quantity } = req.body;
    const userId = req.session.user.id;

    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart) return res.json({ success: false, message: "Cart not found" });

    const item = cart.items.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    // Validate stock
    const product = item.product;
    const variant = product.variants[item.variantIndex];

    if (!variant) return res.json({ success: false, message: "Variant missing" });

    if (quantity > variant.stock) {
      return res.json({
        success: false,
        message: `Only ${variant.stock} items available`
      });
    }

  
    item.quantity = quantity;
    await cart.save();

    return res.json({ success: true });

  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: "Error updating quantity" });
  }
};


export const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const itemId = req.params.itemId;       
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.json({ success: false, message: "Cart not found" });

    cart.items = cart.items.filter(i => i._id.toString() !== itemId);

    await cart.save();

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Cannot remove item" });
  }
};



export const clearCart = async (req, res) => {
    await Cart.findOneAndUpdate(
        { user: req.session.user.id },
        { items: [] }
    );
    res.json({ success: true });
};
