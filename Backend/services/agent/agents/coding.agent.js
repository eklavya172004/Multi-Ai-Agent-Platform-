import { checkAgentLimit } from "../config/agentRateLimit.js";
import { getModel } from "../lib/model.js"
import { deductCredits } from "../utils/deductCredits.js";


export const codeAgent = async (state) => { 

    await checkAgentLimit(state.userId,'coding')
    const intentllm =   await getModel("intent")
    const llm = await getModel("coding")
    const intentRes = await intentllm.invoke(`
            You are an intent classifier.

            Return ONLY one of these values.

            CODE_GENERATION
            CODE_REVIEW
            CODE_EXPLANATION
            DEBUGGING
            OPTIMIZATION
            CONVERSION
            DOCUMENTATION

            User Request:
            ${state.prompt}
            `);

            const intent = intentRes.content.trim().toUpperCase();

            if(intent == "CODE_GENERATION"){
            const prompt = `
                            You are CortexAI Coding Agent.

                            Generate the requested project.

                            Default stack:
                            - HTML
                            - CSS
                            - JavaScript

                            Use React / Next.js / Vue ONLY if explicitly requested.

                            Rules:

                            - Responsive
                            - Modern UI
                            - CSS Variables
                            - Flexbox/Grid
                            - Smooth Scroll
                            - Hover Effects
                            - Beautiful spacing
                            - Single page unless user asks otherwise.

                            IMAGES
                            ===========================

                            Always use real Unsplash images.

                            Never use placeholders.
                            
                            Return ONLY valid JSON.

                            Schema:

                            {
                            "files": [
                                {
                                "name": "index.html",
                                "content": "..."
                                },
                                {
                                "name": "style.css",
                                "content": "..."
                                },
                                {
                                "name": "script.js",
                                "content": "..."
                                }
                            ]
                            }

                            Rules:

                            - Output must start with {
                            - Output must end with }
                            - No markdown
                            - No explanation
                            - No extra text
                                        - Do not wrap the response in triple backticks.
                                        - Never mention intent

                                        User Request:
                                        ${state.prompt}
                                 `
            
                const res = await llm.invoke(prompt)

                let content = res.content.trim();

                content = content
                    .replace(/^```json\s*/i, "")
                    .replace(/^```\s*/i, "")
                    .replace(/\s*```$/, "");

                const response = JSON.parse(content)

                await deductCredits(state.userId,"coding")

                return{
                    ...state,
                    aiResponse:"Code generated Successfully",
                    artifacts : [ {
                        type:"Project",
                        files: response.files || [],
                        title:state.prompt
                    } ]
                }
            }

            const res = await llm.invoke(`
                    The user's request is:

                    ${intent}

                    Return Markdown only.

                    Never generate project files.

                    Use headings like:

                    # Overview

                    ## Explanation

                    ## Problems

                    ## Improvements

                    ## Best Practices

                    ## Optimized Code (if needed)

                    User Request:

                    ${state.prompt}
                    `);

    const data = res.content
    await deductCredits(state.userId,"coding")

    return {
        ...state,
        aiResponse:data,
        artifacts:[]
    }
}