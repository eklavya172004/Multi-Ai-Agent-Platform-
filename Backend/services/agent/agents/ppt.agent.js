import { checkAgentLimit } from "../config/agentRateLimit.js"
import { getModel } from "../lib/model.js"
import { deductCredits } from "../utils/deductCredits.js"
import { generatePPT } from "../utils/generateppt.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { uploadToS3 } from "../utils/uploadToS3.js"

export const pptAgent = async (state) => {
    try {
        await checkAgentLimit(state.userId,'ppt')
        const llm = await getModel("ppt")

        const prompt = `You are a professional presentation designer.

Return ONLY valid JSON.

Format:

{
  "title": "",
  "subtitle": "",
  "slides": [
    {
      "title": "",
      "points": [
        "",
        "",
        "",
        ""
      ]
    }
  ]
}

Rules:
    - Generate exactly 6 content slides.
- Each slide should have 4-6 concise bullet points.
- No markdown.
- No explanation.
- No code block.
- Return ONLY JSON.

Topic:
${state.prompt}`


const response = await llm.invoke(prompt)

const data = JSON.parse(response.content)

await deductCredits(state.userId,"ppt")

const ppt = await generatePPT(data)

const buffer = await ppt.write({
  outputType: "nodebuffer"
})

const filename = `ppt-${Date.now()}.pptx`

await uploadToS3(filename,buffer,"application/vnd.openxmlformats-officedocument.presentationml.presentation")

const downloadUrl = await getFromS3(filename,24*60*60)

return{
    ...state,
    aiResponse:`
# ✅ Presentation Generated

**${data.title}**

📥 [Download PPT](${downloadUrl})

_Link expires in 10 minutes._`
}

    } catch (error) {
        console.log(error)
        return{
            
    ...state,
    aiResponse:"failed to generate PPT"

        }
    }
}