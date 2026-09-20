import prisma from "../../../shared/config/db.js"
import { PLANS } from "../lib/plan.js"
import razorpay from "../lib/razorpay.js"
import axios from 'axios'
import crypto from "crypto";

export const createOrder = async (req,res) => {
    try {
        const {plan} = req.body
        const userId = req.headers["x-user-id"]
        const selectedPlan = PLANS[plan]

        if(!selectedPlan){
            return res.status(404).json({
                message:"Plan not found"
            })
        }

        const order = await razorpay.orders.create({
            amount:selectedPlan.amount * 100,
            currency:"INR",
            receipt:`receipt-${Date.now()}`
        })

                const payment = await prisma.payment.create({
                    data: {
                    userId: userId,
                    orderId: order.id,
                    amount: selectedPlan.amount,
                    currency: "INR",
                    credits: selectedPlan.credits,
                    plan: selectedPlan.id,
                    status: "created"
                    }
        })

        return res.status(200).json({
            order,
            plan:selectedPlan
        })
        
    } catch (error) {
        return res.status(500).json({
            message:`created order failed ${error.message}`
        })
    }
}

export const verifyPayment = async (req,res) => {
    try {
            const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
                    } = req.body

            const generateSignature = crypto.createHmac("sha256",process.env.RAZORPAY_SECRET_KEY)
                                            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                                            .digest('hex')

            
            if(generateSignature !== razorpay_signature){
                return res.status(400).json({
                    "message":"Payment verification failed!!"
                })
            }

        const payment = await prisma.payment.findUnique({
            where: {
                orderId: razorpay_order_id
            }
        });

            if(!payment){
            return res.status(404).json({
                message: "Payment order not found"
            })
            }

            await prisma.payment.update({
            where: {
                orderId: razorpay_order_id,
            },
            data: {
                status: "paid",
                paymentId: razorpay_payment_id,
            },
            });

            await axios.post(`${process.env.AUTH_SERVICE}/update-plan`,{userId:payment.userId,plan:payment.plan,credits:payment.credits})

            console.log("razorpay_order_id:",razorpay_order_id,
            "razorpay_payment_id:",razorpay_payment_id,
            "razorpay_signature:",razorpay_signature)
            return res.status(200).json({
                
                message:"Payment Verified!"
            })

    } catch (error) {
          console.error(error);

  return res.status(500).json({
            success: false,
            message: `Somehthing went wrong ! ${error} `,
        })
    }
}