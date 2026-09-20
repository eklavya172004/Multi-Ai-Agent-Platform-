import express from 'express';
import { deductCredits, login, logout, updateUserPayment } from '../controllers/auth.controller.js';


const router = express.Router();

router.get("/test", (req, res) => {
    res.json({ message: "test route works" });
});

router.post("/login", login);

router.post("/logout", logout);

router.post("/update-plan",updateUserPayment);

router.post("/deduct-credits",deductCredits)

export default router;