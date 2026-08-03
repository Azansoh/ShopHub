const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        required: true,
    },

    price: {
        type: Number,
        required: true,
        min: 0,
    },

    category: {
        type: String,
        required: true,
    },

    images: [
        {
            url: String,
            filename: String
        }
    ],

    stock: {
        type: Number,
        default: 1,
    },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },

    // Reviews belonging to this product
    reviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Review",
        },
    ],
});

// ⚡ CLEANUP MIDDLEWARE FOR PRODUCT DELETION
async function cleanCartAndWishlist(doc) {
    if (doc) {
        const User = mongoose.model("User");
        const Review = mongoose.model("Review");

        // 1. Delete associated reviews
        if (doc.reviews && doc.reviews.length > 0) {
            await Review.deleteMany({ _id: { $in: doc.reviews } });
        }

        // 2. Clear from Wishlist
        await User.updateMany(
            {}, 
            { $pull: { wishlist: doc._id } }
        );

        // 3. Clear from Cart (handles both Object Array & Direct ID Array)
        await User.updateMany(
            {}, 
            { 
                $pull: { 
                    cart: doc._id,
                    "cart.items": { product: doc._id }
                } 
            }
        );
    }
}

productSchema.post("findOneAndDelete", cleanCartAndWishlist);
productSchema.post("deleteOne", { document: true, query: false }, cleanCartAndWishlist);

module.exports = mongoose.model("Product", productSchema);