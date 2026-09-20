import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getModel } from "../lib/model.js"
import fs from 'fs/promises'   // <-- use the promise-based API
import { deductCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentRateLimit.js"

export const imageAnalyser = async (state) => {
    try {
        await checkAgentLimit(state.userId,'image')
        const llm = await getModel("imageAnalyser")

        const imageBuffer = await fs.readFile(state.file.path)
        const base64Image = imageBuffer.toString("base64") // <-- fixed casing

        const messages = [
            new SystemMessage(
                `You are Avnillm image analyzer Agent.

                Rules:

                - Analyze only the uploaded image.
                - Answer the user's question accurately.
                - If text exists in the image, extract it.
                - If charts or tables exist, explain them.
                - If something is unclear, say so.
                - Use Markdown when helpful.
                - Do not hallucinate.`
            ),
            new HumanMessage({
                content: [
                    {
                        type: "text",
                        text: state.prompt || "analyse the image"
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${state.file.mimetype};base64,${base64Image}`
                        }
                    }
                ]
            })
        ]

        const response = await llm.invoke(messages)
        await deductCredits(state.userId, "vision")

        return {
            ...state,
            aiResponse: response.content
        }

    } catch (error) {
        console.log(error)

        return {
            ...state,
            aiResponse: "Failed to analyze the file"
        }
    } finally {
        try {
            await fs.unlink(state.file.path) // now works with fs/promises
        } catch (unlinkErr) {
            console.log("Failed to delete temp file:", unlinkErr)
        }
    }
}