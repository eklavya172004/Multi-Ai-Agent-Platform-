import axios from "axios"

export const deductCredits = async (userId,agent) => {
    try {
        if (!userId) {
            throw new Error("Missing userId for credit deduction");
        }

        const {data} = await axios.post(
            `${process.env.AUTH_SERVICE}/deduct-credits`,
            { userId, agent },
            {
                headers: {
                    "x-user-id": userId,
                },
            }
        )

        return data
        
    } catch (error) {
        console.error("deductCredits request failed:", error.response?.data ?? error.message)
        throw error
    }
}