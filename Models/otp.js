const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    code: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // Automatically delete after 5 minutes
    }
});

module.exports = mongoose.model("OTP", otpSchema);