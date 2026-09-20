import { Annotation } from "@langchain/langgraph"

export const AgentState = Annotation.Root({
    prompt:Annotation(),
    aiResponse:Annotation(),
    agent:Annotation(),
    conversationId:Annotation(),
    searchResults:Annotation(),
    images:Annotation(),
    artifacts:Annotation(),
    userId:Annotation(),
    file:Annotation()
})