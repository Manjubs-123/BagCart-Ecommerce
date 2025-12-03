// utils/applyOffer.js
import Offer from "../models/offerModel.js";


export async function applyOfferToProduct(product) {
    try {
        const now = new Date();

        // Pick FIRST VARIANT
        const variant = product.variants?.[0];

        if (!variant) {
            return {
                originalPrice: 0,
                regularPrice: 0,
                finalPrice: 0,
                appliedOffer: null
            };
        }

        const originalPrice = Number(variant.price) || 0;
        const regularPrice = Number(variant.mrp) || originalPrice;

        // If product doesn't have category populated, you need to fetch it
        const categoryId = product.category?._id || product.category;
        
        if (!categoryId) {
            return {
                originalPrice,
                regularPrice,
                finalPrice: originalPrice,
                appliedOffer: null
            };
        }

        // Fetch both product + category offers
        const offers = await Offer.find({
            isActive: true,
            validFrom: { $lte: now },
            validTo: { $gte: now },
            $or: [
                { type: "product", products: product._id },
                { type: "category", categories: categoryId }
            ]
        }).lean();

        // If no offers exist → return original prices
        if (!offers.length) {
            return {
                originalPrice,
                regularPrice,
                finalPrice: originalPrice,
                appliedOffer: null
            };
        }

        // PICK HIGHEST OFFER
        const bestOffer = offers.sort((a, b) => b.discountValue - a.discountValue)[0];
        const discount = Number(bestOffer.discountValue) || 0;
        
        // Calculate final price (round to nearest integer)
        const finalPrice = Math.round(originalPrice - (originalPrice * discount / 100));

        return {
            originalPrice,
            regularPrice,
            finalPrice,
            appliedOffer: {
                offerId: bestOffer._id,
                offerType: bestOffer.type,
                discountValue: discount,
                offerName: bestOffer.name // Optional: include offer name
            }
        };
    } catch (error) {
        console.error("Error applying offer to product:", error);
        // Return default values on error
        const variant = product.variants?.[0];
        const originalPrice = variant?.price || 0;
        return {
            originalPrice,
            regularPrice: originalPrice,
            finalPrice: originalPrice,
            appliedOffer: null
        };
    }
}