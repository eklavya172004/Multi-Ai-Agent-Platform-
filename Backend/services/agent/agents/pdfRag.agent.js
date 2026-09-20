import fs from 'fs/promises'
import { PDFParse } from 'pdf-parse'
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createVectorStore, getVectorStore, collectionExists } from '../config/vectorDB.js';
import { getModel } from '../lib/model.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { deductCredits } from '../utils/deductCredits.js';
import { checkAgentLimit } from '../config/agentRateLimit.js';

export const pdfRag = async (state) => {
    let fileToCleanup = state.file?.path || null

    try {
        // Collection is tied to the conversation, not the individual upload,
        // so repeat questions in the same thread reuse the same embedded PDF.
                    await checkAgentLimit(state.userId,'pdf')
        const collectionName = `pdf-${state.conversationId}`
        const alreadyEmbedded = await collectionExists(collectionName)

        let store

        if (alreadyEmbedded) {
            // Skip re-parsing/re-embedding entirely — huge speed + cost win
            store = await getVectorStore(collectionName)
        } else {
            if (!state.file?.path) {
                return {
                    ...state,
                    aiResponse: "No PDF found for this conversation. Please upload one first."
                }
            }

            const buffer = await fs.readFile(state.file.path)
            const pdf = new PDFParse({ data: buffer })
            const result = await pdf.getText()
            const text = result.text

            // Smaller chunks + larger overlap = short factual lines (like a single
            // bullet point) are less likely to get buried inside a 1000-char chunk
            // dominated by unrelated content.
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 500,
                chunkOverlap: 100,
            })

            const docs = await splitter.createDocuments([text])
            store = await createVectorStore(docs, collectionName)
        }

        const llm = await getModel("pdf-rag")

        // --- Query normalization step ---
        // Fixes typos/vague phrasing before it ever hits the embedding model,
        // e.g. "personal habbit" -> "personal habits".
        const normalizedQuery = await normalizeQuery(llm, state.prompt)

        // MMR retrieval: pulls a wider, more diverse candidate pool (fetchK)
        // then selects the k most relevant-but-non-redundant chunks. This finds
        // short/isolated facts that plain top-k similarity search tends to miss.
        const relevantDocs = await store.maxMarginalRelevanceSearch(normalizedQuery, {
            k: 8,
            fetchK: 20,
        })

        const context = relevantDocs.map(d => d.pageContent).join("\n\n")

        const messages = [
            new SystemMessage(`You are CortexAI PDF Assistant.

            Rules:
            - Answer using the provided context from the uploaded PDF.
            - The user's question may contain spelling mistakes or be phrased loosely — interpret their intent charitably.
            - If the context contains information that is clearly relevant even if not an exact phrase match, use it to answer.
            - Never invent information that isn't supported by the context.
            - Only say you couldn't find the answer if the context truly has nothing relevant to the question.
            - Use Markdown formatting.
            `),
            new HumanMessage(`
                Context:
                ${context}

                Question: ${state.prompt}
            `)
        ]

        const response = await llm.invoke(messages)
        await deductCredits(state.userId, "pdf")

        return {
            ...state,
            aiResponse: response.content
        }

    } catch (error) {
        console.log(error)
        return {
            ...state,
            aiResponse: "Failed to analyse the pdf"
        }
    } finally {
        // Only the first turn actually has a file on disk to clean up;
        // follow-up turns reuse the existing Qdrant collection and have no file.
        if (fileToCleanup) {
            try {
                await fs.unlink(fileToCleanup)
            } catch (err) {
                console.log("Cleanup failed:", err)
            }
        }
    }
}

const normalizeQuery = async (llm, rawQuery) => {
    try {
        const messages = [
            new SystemMessage(
                `Rewrite the user's question to fix spelling mistakes and clarify vague phrasing, keeping the original meaning and intent exactly. Return ONLY the rewritten question, nothing else.`
            ),
            new HumanMessage(rawQuery)
        ]
        const result = await llm.invoke(messages)
        return result.content?.trim() || rawQuery
    } catch (err) {
        // If normalization fails for any reason, fall back to the raw query
        // rather than breaking retrieval entirely.
        console.log("Query normalization failed:", err)
        return rawQuery
    }
}