const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose").default || require("passport-local-mongoose");

const userSchema = new mongoose.Schema(
{
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    googleId: {
        type: String,
        default: null
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ["customer", "admin"],
        default: "customer"
    },
    // Track account creation for TTL cleanup
    createdAt: {
        type: Date,
        default: Date.now
    },
    cart: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },
            quantity: {
                type: Number,
                default: 1,
                min: 1
            }
        }
    ],
    wishlist: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product"
        }
    ]
},
{
    timestamps: true
});

// =======================================================
// TTL INDEX: Auto-delete unverified users after 10 mins (600s)
// If isVerified becomes true, MongoDB will automatically skip deleting them.
// =======================================================
userSchema.index(
    { createdAt: 1 }, 
    { 
        expireAfterSeconds: 300, 
        partialFilterExpression: { isVerified: false } 
    }
);

// Passport Plugin configuration
userSchema.plugin(passportLocalMongoose, {
    usernameField: "username",
    findByUsername: function (model, queryParameters, cb) {
        return model.findOne(queryParameters, cb);
    }
});

module.exports = mongoose.model("User", userSchema);