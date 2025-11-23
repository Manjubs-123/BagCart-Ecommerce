import Wallet from "../../models/walletModel.js";

// 📌 Render Wallet Page
export const getWalletPage = async (req, res) => {
  try {
    const userId = req.session.user.id;

    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        transactions: []
      });
    }

    res.render("user/wallet", { wallet });

  } catch (err) {
    console.error("Wallet Page Error:", err);
    res.render("user/wallet", { wallet: { balance: 0, transactions: [] } });
  }
};

// 📌 CREDIT Money to Wallet (Used for Refunds)
// export const creditToWallet = async (userId, amount, description) => {
//   let wallet = await Wallet.findOne({ user: userId });

//   if (!wallet) {
//     wallet = await Wallet.create({
//       user: userId,
//       balance: 0,
//       transactions: []
//     });
//   }

//   wallet.balance += amount;

//   wallet.transactions.push({
//     type: "credit",
//     amount,
//     description
//   });

//   await wallet.save();
// };

// // 📌 DEBIT Money
// export const debitFromWallet = async (userId, amount, description) => {
//   const wallet = await Wallet.findOne({ user: userId });

//   if (!wallet || wallet.balance < amount) return false;

//   wallet.balance -= amount;

//   wallet.transactions.push({
//     type: "debit",
//     amount,
//     description
//   });

//   await wallet.save();
//   return true;
// };
