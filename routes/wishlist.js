const express = require("express");

const router = express.Router();

const wishlistController = require("../controllers/wishlist");

const { isLoggedIn } = require("../middleware/middleware");


// Wishlist Page
router.get(
    "/wishlist",
    isLoggedIn,
    wishlistController.showWishlist
);


// Add to Wishlist
router.post(
    "/products/:id/wishlist",
    isLoggedIn,
    wishlistController.addToWishlist
);


// Remove from Wishlist
router.delete(
    "/wishlist/:id",
    isLoggedIn,
    wishlistController.removeFromWishlist
);


// Move Wishlist Product to Cart
router.post(
    "/wishlist/:id/cart",
    isLoggedIn,
    wishlistController.moveToCart
);


module.exports = router;