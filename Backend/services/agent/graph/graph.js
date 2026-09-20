import { StateGraph } from "@langchain/langgraph";
import { AgentState } from "./state.js";
import { router } from "./router.js";
import { chatAgent } from "../agents/chat.agent.js";
import { codeAgent } from "../agents/coding.agent.js";
import {  pdfAgent } from "../agents/pdf.agent.js";
import {  pptAgent } from "../agents/ppt.agent.js";
import {  searchAgent } from "../agents/search.agent.js";
import {  visionAgent } from "../agents/vision.agent.js";
import { pdfRag } from "../agents/pdfRag.agent.js";
import { imageAnalyser } from "../agents/imageAnalyser.agent.js";

const workflow = new StateGraph(AgentState)

workflow.addNode("router",router)
workflow.addNode("chat",chatAgent)
workflow.addNode("coding",codeAgent)
workflow.addNode("pdf",pdfAgent)
workflow.addNode("ppt",pptAgent)
workflow.addNode("search",searchAgent)
workflow.addNode("vision",visionAgent)
workflow.addNode("pdfRag",pdfRag)
workflow.addNode("imageAnalyser",imageAnalyser)

workflow.addEdge("__start__","router")
workflow.addConditionalEdges("router",(state) => {

    switch (state.agent) {
        case "chat":
            return "chat";
        case "search":
            return "search";
        case "coding":
            return "coding";
        case "pdf":
            return "pdf";
        case "ppt":
            return "ppt";
        case "vision":
            return "vision";
        case "pdfRag":
            return "pdfRag";
        case "imageAnalyser":
            return "imageAnalyser";
        default:
            return "chat";
    }
},{
    chat:"chat",
    search:"search",
    coding:"coding",
    pdf:"pdf",
    ppt:"ppt",
    vision:"vision",
    pdfRag:"pdfRag",
    imageAnalyser:"imageAnalyser"
})

workflow.addEdge("search","chat")
workflow.addEdge("chat","__end__")
workflow.addEdge("coding","__end__")
workflow.addEdge("pdf","__end__")  
workflow.addEdge("ppt","__end__")
workflow.addEdge("vision","__end__")
workflow.addEdge("pdfRag","__end__")
workflow.addEdge("imageAnalyser","__end__")
 
export const graph = workflow.compile()