const Product = require("../Models/products");
const Order = require("../Models/order");
const Review = require("../Models/review");

// Check if user is logged in
module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "Please login first.");
        
        return req.session.save(() => {
            res.redirect("/login");
        });
    }
    next();
};

// Check Product Ownership
module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    const product = await Product.findById(id);

    // 1. Guard against non-existent products
    if (!product) {
        req.flash("error", "Product not found!");
        return req.session.save(() => {
            res.redirect("/products");
        });
    }

    // 2. Guard against missing owner field on older products
    if (!product.owner) {
        req.flash("error", "This product does not have an assigned owner.");
        return req.session.save(() => {
            res.redirect(`/products/${id}`);
        });
    }

    // 3. Compare product owner ID with logged-in user ID safely
    if (!product.owner.equals(req.user._id)) {
        req.flash("error", "You don't have permission.");
        return req.session.save(() => {
            res.redirect(`/products/${id}`);
        });
    }

    next();
};

// Check if logged-in user bought and received this product
module.exports.hasPurchasedProduct = async (req, res, next) => {
    const { id } = req.params; // Product ID
    const userId = req.user._id;

    // FIX: Changed orderStatus -> status to match Order model schema
    const purchasedOrder = await Order.findOne({
        user: userId,
        "items.product": id,
        status: "Delivered",
    });

    if (!purchasedOrder) {
        req.flash("error", "Only customers who purchased and received this product can leave a review.");
        return res.redirect(`/products/${id}`);
    }

    next();
};

// Authorization Check: Only Review Author can update/delete
module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);

    if (!review) {
        req.flash("error", "Review not found.");
        return res.redirect(`/products/${id}`);
    }

    if (!review.author.equals(req.user._id)) {
        req.flash("error", "You do not have permission to do that!");
        return res.redirect(`/products/${id}`);
    }

    next();
};

// Check if logged-in user is an admin
module.exports.isAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "You must be logged in.");
        return res.redirect("/login");
    }

    // FIX: Checks both req.user.isAdmin AND req.user.role === 'admin'
    const isUserAdmin = req.user.isAdmin || req.user.role === "admin";

    if (!isUserAdmin) {
        req.flash("error", "You are not authorized to access this page.");
        return res.redirect("/products");
    }

    next();
};