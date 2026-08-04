const express = require("express");
const router = express.Router();
const cart = require("../controllers/cart");
const { isLoggedIn } = require("../middleware/middleware");

// Require authentication for ALL cart routes
router.use(isLoggedIn);

// Show cart
router.get("/", cart.showCart);

// Add product
router.post("/add/:id", cart.addToCart);

// Increase quantity
router.post("/increase/:id", cart.increaseQuantity);

// Decrease quantity
router.post("/decrease/:id", cart.decreaseQuantity);

// Remove product
router.post("/remove/:id", cart.removeFromCart);

// Validate cart before checkout
router.get("/checkout", cart.validateCart);

// Buy Now / Direct Checkout
router.post("/checkout/direct/:id", cart.buyNow);
router.get("/checkout/direct/:id", cart.buyNow);

module.exports = router;