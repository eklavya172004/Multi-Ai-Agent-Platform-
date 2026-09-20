import express from 'express';
import { createConversation, getConversation, getMessage, saveMessage, updateConversation } from '../controllers/chat.controller.js';

const router = express.Router();


router.post("/create-conversation",createConversation)

router.get("/get-conversations",getConversation)

router.post("/update-conversation",updateConversation)

router.post("/save-message",saveMessage)

router.get("/get-message/:conversationId",getMessage)

export default router;