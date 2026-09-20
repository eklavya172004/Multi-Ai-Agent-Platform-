import express from 'express';
import { createOrder, verifyPayment } from '../controllers/billing.controller.js';

const router = express.Router()

router.post('/create-payment',createOrder)

router.post('/verify-payment',verifyPayment)

export default router