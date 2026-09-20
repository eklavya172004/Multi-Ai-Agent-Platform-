import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  messages:[],
  isLoading:false,
  artifacts:[]
}

export const messageSlice = createSlice({
  name: 'message',
  initialState,
  reducers: {
        setMessages:(state,action) => {
            state.messages = action.payload
        },
        setIsLoading:(state,action)=>{

          state.isLoading=action.payload;
        },
        addMessage:(state,action)=>{

          state.messages.push(action.payload)
        },
        setArtifacts:(state,action) => {
          state.artifacts = action.payload
        }
  },
})


export const {setMessages,setIsLoading,addMessage,setArtifacts} = messageSlice.actions

export default messageSlice.reducer