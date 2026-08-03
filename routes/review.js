const express = require("express");
const router = express.Router({ mergeParams: true });

const reviewController = require("../controllers/review");
const { isLoggedIn, hasPurchasedProduct, isReviewAuthor } = require("../middleware/middleware");

// Create Review
router.post(
    "/:id/reviews",
    isLoggedIn,
    hasPurchasedProduct,
    reviewController.createReview
);

// Update Review
router.put(
    "/:id/reviews/:reviewId",
    isLoggedIn,
    isReviewAuthor,
    reviewController.updateReview
);

// Delete Review
router.delete(
    "/:id/reviews/:reviewId",
    isLoggedIn,
    isReviewAuthor,
    reviewController.deleteReview
);

module.exports = router;