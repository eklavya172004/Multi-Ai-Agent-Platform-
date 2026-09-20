import { checkAgentLimit } from "../config/agentRateLimit.js"
import { searchtool } from "../config/tavily.js"
import { deductCredits } from "../utils/deductCredits.js"

export const searchAgent = async (state) => {
        try {
               await checkAgentLimit(state.userId,'search')
            const results = await searchtool.invoke({
                query:state.prompt
            })

            await deductCredits(state.userId,"search")

            console.log(results)

            return {
                ...state,
                searchResults:results,
                images:results.images
            }
        } catch (error) {
            return {
                ...state,
                searchResults:[],
                images:[]
            }
        }
}