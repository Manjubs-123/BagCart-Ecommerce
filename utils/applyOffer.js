import Offer from "../models/offerModel.js";

export async function applyOfferToProduct(product) {
    try {
        const now = new Date();
        const categoryId = product.category?._id || product.category;

        // Fetch all applicable offers
        const offers = await Offer.find({
            isActive: true,
            validFrom: { $lte: now },
            validTo: { $gte: now },
            $or: [
                { type: "product", products: product._id },
                { type: "category", categories: categoryId }
            ]
        }).lean();

        // If no offers exist → return original prices for all variants
        if (!offers.length) {
            return {
                variants: product.variants.map((v) => ({
                    regularPrice: v.mrp || v.price,
                    finalPrice: v.price,
                    appliedOffer: null
                }))
            };
        }

        // Process each variant separately
        const processedVariants = product.variants.map((v) => {
            const mrp = Number(v.mrp) || Number(v.price);
            let bestOffer = null;
            let highestDiscount = 0;

            offers.forEach((offer) => {
                const discountAmount = (mrp * offer.discountValue) / 100;
                if (discountAmount > highestDiscount) {
                    highestDiscount = discountAmount;
                    bestOffer = offer;
                }
            });

            const finalPrice = Math.round(mrp - highestDiscount);

            return {
                regularPrice: mrp,
                finalPrice,
                appliedOffer: bestOffer
                    ? {
                          offerId: bestOffer._id,
                          offerType: bestOffer.type,
                          discountValue: bestOffer.discountValue,
                          offerName: bestOffer.name
                      }
                    : null
            };
        });

        return {
            variants: processedVariants
        };
    } catch (err) {
        console.error("Error applying offer:", err);

        // Fallback: return original pricing
        return {
            variants: product.variants.map((v) => ({
                regularPrice: v.mrp || v.price,
                finalPrice: v.price,
                appliedOffer: null
            }))
        };
    }
}
