import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getMemory } from "../config/memory.js"
import { getModel } from "../lib/model.js"
import { deductCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentRateLimit.js"

export const chatAgent = async (state) => {

    await checkAgentLimit(state.userId,'chat')

    const llm = await getModel("chat")

    const history = await getMemory(state.conversationId)

    const searchResults = Array.isArray(state.searchResults?.results)
        ? state.searchResults.results
        : Array.isArray(state.searchResults)
            ? state.searchResults
            : []

    const searchContext = searchResults.length > 0 ? `
        Web Search Results:

        ${searchResults
            .slice(0, 5)
            .map((r, i) => `${i + 1}. ${r.title ?? "Untitled"}\n${(r.content ?? "").slice(0, 500)}\nSource: ${r.url ?? ""}`)
            .join("\n\n")}

        Answer the user using only the above search results.
        ` : ""

    const systemprompt = `
    You are AvniLLm, an intelligent AI assistant.

    ${searchContext}

    If searchContext exists:

    -use searchcontext to answer.
    -do not mention internal tools.

    Rules:

    - For simple questions, greetings, and short queries, respond naturally in plain text.
    - For technical, educational, coding, or detailed topics, use clean Markdown.

    Formatting:

    - Use # for titles and ## for sections.
    - Leave a blank line after headings.
    - Use bullet points for lists.
    - Use numbered lists for steps.
    - Use fenced code blocks with language tags for code.
    - Keep paragraphs short and readable.
    - Never write headings and content on the same line.
    - Never generate large walls of text.
    `

    const messages = [
        new SystemMessage(systemprompt)
    ]

    history.slice(-10).forEach(msg => {
        if(msg.role == "user"){
            messages.push(new HumanMessage(msg.content))
        }else{
            messages.push(new AIMessage(msg.content))
        }
    })

    messages.push(new HumanMessage(state.prompt))

    const response = await llm.invoke(messages)

    await deductCredits(state.userId,"chat")

    const aiResponse = response?.content?.trim()

    if (aiResponse) {
        return {
            ...state,
            aiResponse
        }
    }

    if (searchResults.length > 0) {
        const fallback = searchResults
            .slice(0, 10)
            .map((item, index) => {
                const title = item?.title ?? item?.name ?? `Result ${index + 1}`
                const url = item?.url ? `\n${item.url}` : ""
                const snippet = item?.content ? `\n${item.content.slice(0, 300)}` : ""

                return `${index + 1}. ${title}${url}${snippet}`
            })
            .join("\n\n")

        return {
            ...state,
            aiResponse: fallback
        }
    }

    return {
        ...state,
        aiResponse: "I could not generate a response for that query."
    }
}