import Wallet from "../../models/walletModel.js";


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


export const getWalletBalance = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.json({ success: false, balance: 0 });
    }

    const wallet = await Wallet.findOne({ user: userId }).lean();

    return res.json({
      success: true,
      balance: wallet?.balance || 0,
    });
  } catch (err) {
    console.error("WALLET BALANCE ERROR:", err);
    return res.json({ success: false, balance: 0 });
  }
};