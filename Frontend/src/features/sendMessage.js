import api from "../../utils/axios"

export default async function sendMessage(payload) {
    try {
        const {data} = await api.post("/api/agent/chat",payload)

        console.log("Backend response:", data);

        return data

    } catch (error) {
        console.log(error)

        return error?.response?.data ?? null
    }
}
