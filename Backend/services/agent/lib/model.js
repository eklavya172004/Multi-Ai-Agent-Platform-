import { ChatGroq } from "@langchain/groq"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatOpenRouter } from "@langchain/openrouter";

console.log("GROQ:", process.env.GROQ_API_KEY);
console.log("GOOGLE:", process.env.GOOGLE_API_KEY);

const groq = new ChatGroq({
    model: "openai/gpt-oss-120b"
})


const gemini = new ChatGoogleGenerativeAI({
    model: "gemini-3.6-flash"
})

const openrouter =  new ChatOpenRouter({
  model: "deepseek/deepseek-chat",
  temperature:0,
  maxTokens:2500
});

export const getModel = async (agent) => {
    switch (agent){
        case "chat":
            return groq;
        case "search": 
            return groq;
        case "coding":
            return openrouter;
        case "imageAnalyser":
            return gemini;
        
        default:
            return groq;
    }
}