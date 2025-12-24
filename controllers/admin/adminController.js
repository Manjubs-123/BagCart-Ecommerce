import dotenv from "dotenv";
dotenv.config();
import Order from "../../models/orderModel.js";
import User from "../../models/userModel.js";
import moment from "moment";

export const renderAdminLogin = (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.session.isAdmin) {
    return res.redirect("/admin/dashboard");
  }

  const error =
    req.query.error === "invalid" ? "Invalid email or password" :
    req.query.error === "missing" ? "Email and password are required" :
    null;

  res.render("admin/login", { error });
};



export const postAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.redirect("/admin?error=missing");
    }

    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      // CRITICAL FIX: Preserve existing user session if it exists
      const wasUserLoggedIn = req.session.isLoggedIn;
      const existingUser = req.session.user;

      // Don't regenerate - just update the session
      req.session.isAdmin = true;

      // RESTORE user session if it existed
      if (wasUserLoggedIn && existingUser) {
        req.session.isLoggedIn = true;
        req.session.user = existingUser;
      }

      // Save session explicitly
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect("/admin?error=server");
        }
        console.log("Admin logged in, session preserved:", {
          isAdmin: req.session.isAdmin,
          userStillLoggedIn: req.session.isLoggedIn
        });
        return res.redirect("/admin/dashboard");
      });

    } else {
      return res.redirect("/admin?error=invalid");
    }

  } catch (err) {
    console.error("Admin login error:", err);
    return res.redirect("/admin?error=server");
  }
};

export const adminLogout = (req, res) => {
  // Preserve user session if exists
  const wasUserLoggedIn = req.session.isLoggedIn;
  const existingUser = req.session.user;
  
  // Clear admin session
  req.session.isAdmin = false;
  
  // Restore user session
  if (wasUserLoggedIn && existingUser) {
    req.session.isLoggedIn = true;
    req.session.user = existingUser;
  }
  
  req.session.save((err) => {
    if (err) console.error("Session save error:", err);
    res.redirect("/admin");
  });
};


export const renderAdminDashboard = async (req, res) => {
  try {

    
    const bestProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          unitsSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo"
        }
      },
      { $unwind: "$categoryInfo" },
      {
        $project: {
          productName: "$productInfo.name",
          categoryName: "$categoryInfo.name",
          unitsSold: 1,
          totalRevenue: 1
        }
      },
      { $sort: { unitsSold: -1 } },
      { $limit: 10 }
    ]);

    
const bestCategories = await Order.aggregate([
  { $unwind: "$items" },
  {
    $lookup: {
      from: "products",
      localField: "items.product",
      foreignField: "_id",
      as: "productInfo"
    }
  },
  { $unwind: "$productInfo" },
  {
    $lookup: {
      from: "categories",
      localField: "productInfo.category",
      foreignField: "_id",
      as: "categoryInfo"
    }
  },
  { $unwind: "$categoryInfo" },
  {
    $group: {
      _id: "$categoryInfo._id",
      category: { $first: "$categoryInfo.name" },
      totalSold: { $sum: "$items.quantity" }
    }
  },
  { $sort: { totalSold: -1 } },
  { $limit: 10 }
]);

/* -------------------
       DASHBOARD SUMMARY STATS
    ---------------------*/

    
    const totalRevenueResult = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const totalRevenueRaw = (totalRevenueResult.length ? totalRevenueResult[0].total : 0) || 0;
    const totalRevenue = Number(totalRevenueRaw);
    const totalRevenueDisplay = totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 }); 

 
    const uniqueUserIds = await Order.distinct("user");
    const totalCustomersBuyers = Array.isArray(uniqueUserIds) ? uniqueUserIds.length : 0;

    

    // Total orders
    const totalOrders = await Order.countDocuments();

    // Monthly/weekly and growth stats
    const now = moment();
    const startOfThisMonth = now.clone().startOf("month").toDate();
    const startOfPrevMonth = now.clone().subtract(1, "month").startOf("month").toDate();
    const endOfPrevMonth = now.clone().subtract(1, "month").endOf("month").toDate();

    const ordersThisMonth = await Order.countDocuments({ createdAt: { $gte: startOfThisMonth } });
    const ordersPrevMonth = await Order.countDocuments({ createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } });

  
    const customersThisMonthIds = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfThisMonth } } },
      { $group: { _id: "$user" } }
    ]);
    const customersPrevMonthIds = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } } },
      { $group: { _id: "$user" } }
    ]);
    const customersThisMonth = customersThisMonthIds.length;
    const customersPrevMonth = customersPrevMonthIds.length;

    // weekly
    const startOfThisWeek = now.clone().startOf("week").toDate();
    const startOfPrevWeek = now.clone().subtract(1, "week").startOf("week").toDate();
    const endOfPrevWeek = now.clone().subtract(1, "week").endOf("week").toDate();

    const ordersThisWeek = await Order.countDocuments({ createdAt: { $gte: startOfThisWeek } });
    const ordersPrevWeek = await Order.countDocuments({ createdAt: { $gte: startOfPrevWeek, $lte: endOfPrevWeek } });

    // growth helper
    function growthPercent(current, previous) {
      if ((previous === 0 || previous === null) && (current === 0 || current === null)) return { percent: 0, isUp: true };
      if ((previous === 0 || previous === null) && current > 0) return { percent: 100, isUp: true };
      const diff = current - previous;
      if (!previous) return { percent: 0, isUp: diff >= 0 };
      const percent = ((diff / previous) * 100);
      return { percent: Math.round(percent * 10) / 10, isUp: percent >= 0 };
    }

    const revenueThisMonthAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfThisMonth } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const revenuePrevMonthAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const revenueThisMonth = revenueThisMonthAgg.length ? revenueThisMonthAgg[0].total : 0;
    const revenuePrevMonth = revenuePrevMonthAgg.length ? revenuePrevMonthAgg[0].total : 0;

    const revenueGrowth = growthPercent(revenueThisMonth, revenuePrevMonth);
    const customersGrowth = growthPercent(customersThisMonth, customersPrevMonth);
    const ordersGrowth = growthPercent(ordersThisWeek, ordersPrevWeek);

    // monthly goal
    const monthlyGoal = 1000;
    const monthlyProgress = Math.min((ordersThisMonth / monthlyGoal) * 100, 100);
    const monthlyProgressDisplay = Math.round(monthlyProgress * 10) / 10; // 
    const ordersLeft = Math.max(monthlyGoal - ordersThisMonth, 0);

    // Recent 5 orders
const recentOrders = await Order.find()
  .populate("user")
  .populate("items.product")
  .sort({ createdAt: -1 })
  .limit(5);

    res.render("admin/dashboard", {
      title: "Admin Dashboard",

      bestProducts,
      bestCategories,

   
      totalRevenue: totalRevenueDisplay,      
      totalRevenueRaw: totalRevenue,          
      totalCustomers: totalCustomersBuyers,   
                
      totalOrders,

 
      revenueGrowth,
      customersGrowth,
      ordersGrowth,

      ordersThisMonth,
      ordersThisWeek,
      customersThisMonth,
      monthlyProgress: monthlyProgressDisplay,
      ordersLeft,
      recentOrders
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Dashboard error");
  }
};

/* -------------------------------------------------------
   REVENUE ANALYTICS LOGIC (API)
------------------------------------------------------- */
export const getRevenueData = async (req, res) => {
  try {
    const filter = req.query.filter;

    if (filter === "daily") return dailyRevenue(req, res);
    if (filter === "weekly") return weeklyRevenue(req, res);
    if (filter === "monthly") return monthlyRevenue(req, res);
    if (filter === "yearly") return yearlyRevenue(req, res);

    res.json({ labels: [], values: [] });

  } catch (err) {
    console.log(err);
    res.json({ labels: [], values: [] });
  }
};

/* -------------------------------------------------------
   DAILY REVENUE (LAST 7 DAYS)
------------------------------------------------------- */
const dailyRevenue = async (req, res) => {
  const labels = [];
  const values = [];

  for (let i = 6; i >= 0; i--) {
    const day = moment().subtract(i, "days");

    const revenue = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: day.startOf("day").toDate(),
            $lte: day.endOf("day").toDate()
          }
        }
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    labels.push(day.format("ddd")); 
    values.push(revenue.length ? revenue[0].total : 0);
  }

  res.json({ labels, values });
};

/* -------------------------------------------------------
   WEEKLY REVENUE (LAST 5 WEEKS)
------------------------------------------------------- */
const weeklyRevenue = async (req, res) => {
  const labels = [];
  const values = [];

  for (let i = 4; i >= 0; i--) {
    const start = moment().subtract(i, "weeks").startOf("week");
    const end = moment().subtract(i, "weeks").endOf("week");

    const revenue = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start.toDate(),
            $lte: end.toDate()
          }
        }
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    labels.push(`Week ${5 - i}`);
    values.push(revenue.length ? revenue[0].total : 0);
  }

  res.json({ labels, values });
};

/* -------------------------------------------------------
   MONTHLY REVENUE (LAST 12 MONTHS)
------------------------------------------------------- */
const monthlyRevenue = async (req, res) => {
  const labels = [];
  const values = [];

  for (let i = 11; i >= 0; i--) {
    const month = moment().subtract(i, "months");

    const revenue = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: month.startOf("month").toDate(),
            $lte: month.endOf("month").toDate()
          }
        }
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    labels.push(month.format("MMM"));
    values.push(revenue.length ? revenue[0].total : 0);
  }

  res.json({ labels, values });
};

/* -------------------------------------------------------
   YEARLY REVENUE (LAST 5 YEARS)
------------------------------------------------------- */
const yearlyRevenue = async (req, res) => {
  const labels = [];
  const values = [];

  for (let i = 4; i >= 0; i--) {
    const year = moment().subtract(i, "years").year();

    const revenue = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(year, 0, 1),
            $lte: new Date(year, 11, 31, 23, 59, 59)
          }
        }
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    labels.push(year);
    values.push(revenue.length ? revenue[0].total : 0);
  }

  res.json({ labels, values });
};



