import { checkAgentLimit } from "../config/agentRateLimit.js"
import { getModel } from "../lib/model.js"
import { deductCredits } from "../utils/deductCredits.js"
import { generatePDF } from "../utils/generatePdf.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { uploadToS3 } from "../utils/uploadToS3.js"

export const pdfAgent = async (state) => {
    try {
        await checkAgentLimit(state.userId,'pdf')
        const llm = await getModel("pdf")
        const prompt = `
        You are an expert document writer.

        Return ONLY valid JSON.

        Do NOT return markdown.

        Do NOT return explanations.

        Structure:

        {
        "title": "",
        "subtitle": "",
        "sections": [
            {
            "heading": "",
            "points": []
            }
        ]
        }

        Generate 4-8 sections.

        Each section should have 3-6 concise bullet points.

        Topic:

        ${state.prompt}
        `

        const res = await llm.invoke(prompt)

        const data = JSON.parse(res.content)

        await deductCredits(state.userId,"pdf")

        const pdfBuffer =  await generatePDF(data)

        const filename = `pdf-${Date.now()}.pdf`

        await uploadToS3(filename,pdfBuffer,"application/pdf")

        const downloadurl = await getFromS3(filename,60*24)

        const answer = `
# PDF Generated

**${data.title}**

📥 [Download PDF](${downloadurl})

_Link expires in 10 minutes._
`.trim()

        return {
            ...state,
            aiResponse: answer,
            files: [
                {
                    name: `${data.title || "generated-pdf"}.pdf`,
                    url: downloadurl,
                },
            ],
        }

    } catch (error) {
        console.log(error)
        return{
            ...state,
            aiResponse:"Failed to generate PDF"
        }
    }
}