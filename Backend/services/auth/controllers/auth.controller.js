import { getAuth } from "firebase-admin/auth";
import { app } from "../config/firebase.js";
import crypto from "crypto";
// import prisma from "../config/db.js";
import redis from "../../../shared/redis/redis.js";
import prisma from "../../../shared/config/db.js";

export const login = async (req, res) => {
    try {
        const { token } = req.body;

        const decoded = await getAuth(app).verifyIdToken(token);

        let user = await prisma.user.findUnique({
            where: {
                firebaseUID: decoded.uid,
            },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    firebaseUID: decoded.uid,
                    name: decoded.name,
                    email: decoded.email,
                    avatar: decoded.picture,
                },
            });
        }

        const sessionId = crypto.randomUUID();
        await redis.set(`user-session-${user.id}`,sessionId,"EX",
                7 * 24 * 60 * 60)

        redis.set(`session-${sessionId}`,
            JSON.stringify({
                userId:user.id,
                name:user.name,
                email:user.email,
                avatar:user.avatar,
                plan: user.plan,
                credits: user.credits,
                totalCredits: user.totalCredits,
                planExpiresAt: user.planExpiresAt,
            }),"EX",7*24*60*60
        )

        res.cookie("session", sessionId, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json(user);

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: error.message,
        });
    }
};

export const logout = async (req,res) => {
    try {
        const sessionid = req.cookies?.session

        await redis.del(`session-${sessionid}`)

        res.clearCookie("session")

        return res.status(200).json({
            message:"logout successfully"
        })

    } catch (error) {
        return res.status(500).json({
            message:`logout error ${error}`
        })
    }
}

export const updateUserPayment = async (req, res) => {
    try {
        const { plan, credits, userId } = req.body;

        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found!",
            });
        }

        const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                plan,
                credits: {
                    increment: credits,
                },
                totalCredits: {
                    increment: credits,
                },
                planExpiresAt: new Date(
                    Date.now() + 30 * 24 * 60 * 60 * 1000
                ),
            },
        });

        const sessionid = await redis.get(`user-session-${user?.id}`)

        if (sessionid) {
            await redis.set(
                `session-${sessionid}`,
                JSON.stringify({
                    userId: updatedUser.id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    avatar: updatedUser.avatar,
                    plan: updatedUser.plan,
                    credits: updatedUser.credits,
                    totalCredits: updatedUser.totalCredits,
                    planExpiresAt: updatedUser.planExpiresAt,
                }),
                "EX",
                7 * 24 * 60 * 60
            );
        }

        return res.status(200).json({
            success: true,
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update user payment error",
            error: error.message,
        });
    }
}

export const deductCredits = async (req,res) => {
    try {
        const userId = req.body?.userId ?? req.headers["x-user-id"]
        const { agent } = req.body

        if (!userId) {
            return res.status(400).json({
                message: "userId is required"
            })
        }

        if (!agent) {
            return res.status(400).json({
                message: "agent is required"
            })
        }

        console.log("deductCredits hit", { userId, agent })

        const COST = {
            chat: 1,
            search: 5,
            coding: 10,
            pdf: 10,
            ppt: 10,
            vision: 10
            }

        const user = await prisma.user.findUnique({
                    where: {
                        id: userId,
                    },
        })

        if(!user){
            return res.status(400).json({
                message:"user not found!"
            })
        }

        const requiredCredits = COST[agent] || 1

        if(user.credits < requiredCredits){
            return res.status(400).json({
                message:"Not enough credits."
            })
        }

const updatedUser = await prisma.user.update({
    where: {
        id: userId
    },
    data: {
        credits: {
            decrement: requiredCredits
        }
    }
})

const sessionid = await redis.get(`user-session-${updatedUser.id}`)

if (sessionid) {
    await redis.set(
        `session-${sessionid}`,
        JSON.stringify({
            userId: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
            plan: updatedUser.plan,
            credits: updatedUser.credits,
            totalCredits: updatedUser.totalCredits,
            planExpiresAt: updatedUser.planExpiresAt,
        }),
        "EX",
        7 * 24 * 60 * 60
    );
}

return res.status(200).json({
    message: "Credits deducted successfully.",
    credits: updatedUser.credits
})


    } catch (error) {
        console.error("Credit deduction error:", error);

        return res.status(500).json({
            message: "Failed to deduct credits."
        })
    }
}