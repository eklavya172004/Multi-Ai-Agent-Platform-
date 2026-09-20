import { TavilySearch } from "@langchain/tavily";

export const searchtool = new TavilySearch({ 
  maxResults: 10,
  topic: "general",
  includeImages:true
}); 