import axios from "axios";
import { getModel } from "../lib/model.js"
import { uploadToS3 } from "../utils/uploadToS3.js";
import { getFromS3 } from "../utils/getFromS3.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkAgentLimit } from "../config/agentRateLimit.js";

export const visionAgent = async (state) => {
    try {
           await checkAgentLimit(state.userId,'vision')
        const llm = await getModel("image")

        const res = await llm.invoke(`
You are an elite AI image prompt engineer.

Convert the user request into a highly detailed image generation prompt.

Requirements:
- Cinematic lighting
- Professional composition
- Ultra realistic
- High detail
- Beautiful color palette
- Sharp focus
- 8K quality
- Photorealistic
- Depth of field
- Professional photography
- Stunning visuals

Return only the image prompt.

User Request:
${state.prompt}
`)

        const prompt = res.content.trim();

        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

        const imageRes = await axios.get(imageUrl, {
            responseType: "arraybuffer"
        })

        await deductCredits(state.userId,"vision")
        
        const buffer = Buffer.from(imageRes.data)

        const filename = `image-${Date.now()}.png`

        await uploadToS3(filename, buffer, "image/png")

        const downloadUrl = await getFromS3(filename, 60 * 24)

        return {
            ...state,
            aiResponse: "Here's the image you asked for 🖼️",
            images: [downloadUrl]
        }
    } catch (error) {
        console.error("Vision Agent Error:", error);
        console.error(error.response?.data);

        return {
            ...state,
            aiResponse: JSON.stringify(error.response?.data || error.message),
            images: []
        }
    }
}