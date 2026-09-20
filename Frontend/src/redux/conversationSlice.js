import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  conversations:[],
  selectedConversation:null
}

export const conversationSlice = createSlice({
  name: 'conversation',
  initialState,
  reducers: {
    setConversations:(state,action) => {
        state.conversations = action.payload
    },
    addConversation:(state,action) => {
        // element ko insert krta hai at the start of the array
        state.conversations.unshift(action.payload)
    },
        setSelectConversation:(state,action) => {
        // element ko insert krta hai at the start of the array
        state.selectedConversation  = action.payload
    },
      setConvoTitle:(state,action) => {
        const {title,conversationId} = action.payload

        state.conversations = state.conversations.map((convo) => (
          convo.id == conversationId ? (
            {
              ...convo,
              title:title
            }
          ) : convo
        ))

        if(state.selectedConversation?.id == conversationId){
            state.selectedConversation = {...state.selectedConversation,title}
        }
      }
  },
})


export const {setConversations,addConversation,setSelectConversation,setConvoTitle} = conversationSlice.actions

export default conversationSlice.reducer