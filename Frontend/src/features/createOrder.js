import api from "../../utils/axios"

export const createOrder = async (payload) => {
    try {
        const {data} = await api.post('/api/billing/create-payment',payload)

        return data
    } catch (error) {
        console.error("createOrder request failed:", error?.response?.data || error.message)
        throw error?.response?.data ?? error
    }
}