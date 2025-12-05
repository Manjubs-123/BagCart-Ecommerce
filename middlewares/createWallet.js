import Wallet from "../models/walletModel.js";

export const ensureWallet = async (req, res, next) => {
    if (!req.session.user) return next();

    const userId = req.session.user.id;

    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
        wallet = await Wallet.create({
            user: userId,
            balance: 0,
            transactions: []
        });
    }

    next();
};
