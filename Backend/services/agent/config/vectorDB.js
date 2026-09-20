import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { embeddings } from "./embeddings.js";
import dotenv from 'dotenv'

dotenv.config()

const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
})

export const collectionExists = async (collectionName) => {
    try {
        const collections = await client.getCollections()
        return collections.collections.some(c => c.name === collectionName)
    } catch (err) {
        console.log("collectionExists check failed:", err)
        return false
    }
}

// Use when the PDF hasn't been embedded yet
export const createVectorStore = async (docs, collectionName) => {
    return await QdrantVectorStore.fromDocuments(docs, embeddings, {
        client,
        collectionName
    });
}

// Use when the PDF was already embedded in a previous turn
export const getVectorStore = async (collectionName) => {
    return await QdrantVectorStore.fromExistingCollection(embeddings, {
        client,
        collectionName
    });
}