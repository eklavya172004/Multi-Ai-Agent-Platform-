import axios from 'axios'
import { graph } from '../graph/graph.js'
import { addMessage } from '../config/memory.js'
import redis from '../../../shared/redis/redis.js'

export const agent = async (req,res,next) => {
    try {
        const {prompt,conversationId,agent,userId: bodyUserId} = req.body
        const userId = req.headers["x-user-id"] ?? bodyUserId
        const file = req.file

        if (!userId) {
            return res.status(401).json({
                message: "userId is required"
            })
        }

        await axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
            conversationId:conversationId,
            role:"user",
            content:prompt 
        })


        const result = await graph.invoke({
            prompt:prompt,
            conversationId:conversationId,
            agent:agent,
            userId,
            file
        })

console.log("GRAPH RESULT:", JSON.stringify(result, null, 2))
console.log("typeof aiResponse:", typeof result.aiResponse, result.aiResponse)  // add this

        const answer = result?.aiResponse ?? result?.content ?? result?.answer ?? ""
        const images = Array.isArray(result?.images) ? result.images : []
        const files = Array.isArray(result?.files) ? result.files : []
        const artifacts = Array.isArray(result?.artifacts)
            ? result.artifacts
            : [];

        if (!answer) {
            throw new Error("Agent returned an empty response")
        }

        const response = {
            answer,
            images,
            files,
            artifacts
        }

        await addMessage(conversationId,"user",prompt)

        await addMessage(conversationId,"assistant",response.answer)

        await axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
            conversationId:conversationId,
            role:"assistant", 
            content:response.answer ,
            images,
            files,
            artifacts
        })

        return res.status(200).json(response)

    } catch (error) {
               next(error)
    }
}