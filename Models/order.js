const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        customer: {
            fullName: {
                type: String,
                required: true
            },

            address: {
                type: String,
                required: true
            },

            city: {
                type: String,
                required: true
            },

            phone: {
                type: String,
                required: true
            }
        },

        items: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true
                },

                title: {
                    type: String,
                    required: true
                },

                price: {
                    type: Number,
                    required: true
                },

                quantity: {
                    type: Number,
                    required: true,
                    min: 1
                },

                subtotal: {
                    type: Number,
                    required: true
                }
            }
        ],

        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },

        // Order status
        status: {
            type: String,
            enum: [
                "Pending",
                "Processing",
                "Shipped",
                "Delivered",
                "Cancelled"
            ],
            default: "Pending"
        },

        // Payment information
        payment: {
            method: {
                type: String,
                enum: ["COD", "Online"],
                default: "COD"
            },

            status: {
                type: String,
                enum: ["Pending", "Paid", "Failed"],
                default: "Pending"
            },

            paidAt: {
                type: Date,
                default: null
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Order", orderSchema);