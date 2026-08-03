const Review = require("../Models/Review");
const Product = require("../Models/products");

// Create Review
module.exports.createReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body.review;

        const product = await Product.findById(id);
        if (!product) {
            req.flash("error", "Product not found.");
            return res.redirect("/products");
        }

        if (!rating || rating < 1 || rating > 5) {
            req.flash("error", "Rating must be between 1 and 5.");
            return res.redirect(`/products/${id}`);
        }

        if (!comment || comment.trim() === "") {
            req.flash("error", "Please write a review.");
            return res.redirect(`/products/${id}`);
        }

        const review = new Review({
            rating: Number(rating),
            comment: comment.trim(),
            author: req.user._id,
        });

        await review.save();
        product.reviews.push(review._id);
        await product.save();

        req.flash("success", "Your review has been added successfully.");
        res.redirect(`/products/${id}`);
    } catch (error) {
        console.error(error);
        req.flash("error", "Unable to add review.");
        res.redirect("/products");
    }
};

// Update Review
module.exports.updateReview = async (req, res) => {
    try {
        const { id, reviewId } = req.params;
        const { rating, comment } = req.body.review;

        await Review.findByIdAndUpdate(reviewId, {
            rating: Number(rating),
            comment: comment.trim(),
        });

        req.flash("success", "Review updated successfully!");
        res.redirect(`/products/${id}`);
    } catch (error) {
        console.error(error);
        req.flash("error", "Unable to update review.");
        res.redirect("/products");
    }
};

// Delete Review
module.exports.deleteReview = async (req, res) => {
    try {
        const { id, reviewId } = req.params;

        // Pull review reference from product
        await Product.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
        // Delete review object
        await Review.findByIdAndDelete(reviewId);

        req.flash("success", "Review deleted successfully!");
        res.redirect(`/products/${id}`);
    } catch (error) {
        console.error(error);
        req.flash("error", "Unable to delete review.");
        res.redirect(`/products/${id}`);
    }
};