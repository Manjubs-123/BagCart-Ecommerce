import Order from "../../models/orderModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";

export const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { addressId, paymentMethod } = req.body;

    // 1️⃣ Validate address
    const address = await Address.findById(addressId);
    if (!address) {
      return res.json({ success: false, message: "Invalid address" });
    }

    // 2️⃣ Load cart
    const cart = await Cart.findOne({ user: userId }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    // 3️⃣ Validate stock and prepare items
    let subtotal = 0;
    let orderItems = [];

    for (let item of cart.items) {
      const product = item.product;
      const variant = product.variants[item.variantIndex];

      if (!variant || variant.stock < item.quantity) {
        return res.json({
          success: false,
          message: `${product.name} has only ${variant.stock} left`
        });
      }

      // price snapshot
      const price = variant.price;

      subtotal += price * item.quantity;

      orderItems.push({
        product: product._id,
        variantIndex: item.variantIndex,
        quantity: item.quantity,
        price,
        color: variant.color,
        image: variant.images?.[0]?.url || ""
      });
    }

    // 4️⃣ Tax and shipping calculation
    const tax = subtotal * 0.10;
    const shippingFee = subtotal > 500 ? 0 : 50;
    const totalAmount = subtotal + tax + shippingFee;

    // 5️⃣ Create order
    const order = await Order.create({
      user: userId,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country
      },
      items: orderItems,
      paymentMethod,
      subtotal,
      tax,
      shippingFee,
      totalAmount
    });

    // 6️⃣ Reduce stock
    for (let item of cart.items) {
      const product = await Product.findById(item.product._id);

      product.variants[item.variantIndex].stock -= item.quantity;
      await product.save();
    }

    // 7️⃣ Clean user cart
    cart.items = [];
    await cart.save();

    return res.json({
      success: true,
      message: "Order placed successfully!",
      orderId: order._id
    });

  } catch (err) {
    console.error("Order Error:", err);
    res.json({ success: false, message: "Something went wrong placing the order" });
  }
};


export const getOrderConfirmation = async (req, res) => {
  const orderId = req.params.id;

  const order = await Order.findById(orderId).populate("items.product");
  console.log("hello")

  res.render("user/orderConfirmation", { order });
};

export const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product");

    if (!order) return res.status(404).send("Order not found");

    res.render("user/orderDetails", { order });

  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
};

