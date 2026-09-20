import React from 'react'
import api from '../../utils/axios'

const logout = async () => {
    try {
        const {data} = await api.post("/api/auth/logout")

        console.log(data)
    } catch (error) {   
        console.log(error)
    }
}

export default logout