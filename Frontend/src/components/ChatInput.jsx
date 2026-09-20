import { Code2, FileText, FileTextIcon, Globe, ImageIcon, MessageSquare, Mic, Paperclip, Presentation, Send, X, Zap } from "lucide-react"
import { useState } from "react"
import sendMessage from "../features/sendMessage"
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { addMessage, setArtifacts, setIsLoading, setMessages } from "../redux/messageSlice";
import { createConversation } from "../features/createConversation";
import { addConversation, setConvoTitle, setSelectConversation } from "../redux/conversationSlice";
import { updateConversation } from "../features/updateConversation";
import getCurrentUser from "../features/getCurrentUser";
import { setUserData } from "../redux/userSlice";
import { useRef } from "react";
// import { agent } from "../../../Backend/services/agent/controller/agent.controller.js";

function ChatInput() {
    const [value,setvalue] = useState("")
    const { selectedConversation } = useSelector(state => state.conversation);
  const { userData } = useSelector(state => state.user);
    const [selectedAgent, setSelectedAgent] =useState("auto");
    const dispatch = useDispatch();
    const fileRef = useRef(null)
    const {messages} = useSelector(state => state.message);

    const [
    
    selectedFile,
    
    setSelectedFile
    
    ]=useState(null);

const handleSendMessage = async () => {
  const prompt = value.trim();

  if (!prompt) return;

  dispatch(setIsLoading(true));

  try {
    let conversation = selectedConversation;

    if (!conversation) {
      const convo = await createConversation();

      dispatch(setSelectConversation(convo));
      dispatch(addConversation(convo));

      conversation = convo;
    }



    if (conversation.title === "New Chat") {
      const convo = await updateConversation({
        id: conversation.id,
        title: prompt,
      });

      dispatch(
        setConvoTitle({
          conversationId: conversation.id,
          title: prompt.slice(0, 40),
        })
      );

      conversation = convo;
    }

    dispatch(
      addMessage({
        role: "user",
        content: prompt,
      })
    );

    setvalue("");

    const formData = new FormData();

    formData.append("prompt", prompt);
    formData.append("conversationId", conversation.id);
    formData.append("agent", selectedAgent.toLowerCase());
    formData.append("userId", userData?.userId ?? userData?.id);

    if (selectedFile) {
        formData.append("file", selectedFile);
    }

    const data = await sendMessage(formData);
    setSelectedFile(null)

    dispatch(setArtifacts(data?.artifacts ?? []));

    const refreshedUser = await getCurrentUser();
    if (refreshedUser) {
      dispatch(setUserData(refreshedUser));
    }

    dispatch(
      addMessage({
        role: "assistant",
        content: data?.answer ?? "No response received.",
        images: data?.images ?? [],
        files: data?.files ?? [],
        artifacts: data?.artifacts ?? [],
      })
    );
  } catch (error) {
    console.error(error);

    dispatch(
      addMessage({
        role: "assistant",
        content:
          error?.response?.data?.message ||
          error?.message ||
          "Unable to generate a response.",
        images: [],
          files: [],
        artifacts: [],
      })
    );
  } finally {
    dispatch(setIsLoading(false));
  }
};

    const agents = [
      
        {
          id:"auto",
          icon:Zap,
          label:"Auto"
        },
      
        {
          id:"chat",
          icon:MessageSquare,
          label:"Chat"
        },
      
        {
          id:"coding",
          icon:Code2,
          label:"Coding"
        },
      
        {
          id:"pdf",
          icon:FileText,
          label:"PDF"
        },
      
        {
          id:"ppt",
          icon:Presentation,
          label:"PPT"
        },
      
        {
          id:"vision",
          icon:ImageIcon,
          label:"Vision"
        },
      
        {
          id:"search",
          icon:Globe,
          label:"Search"
        }
    ]

  return (
<div className="w-full overflow-hidden px-3 md:px-5 py-4 border-t border-white/[0.06] bg-[#0d0f14]">
  <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 pt-3.5 pb-3">

        <div className="flex w-[80%] gap-2 pr-2 flex-wrap">

    {agents.map((agent) => {

      const Icon = agent.icon;
      const isActive = selectedAgent === agent.id;

      return (

        <button
          key={agent.id}
          onClick={() => setSelectedAgent(agent.id)}
          className={`
            flex-shrink-0
            cursor-pointer
            inline-flex
            items-center
            gap-1.5
            px-3
            py-2
            rounded-full
            text-xs
            font-medium
            border
            transition-all  
            ${
              isActive
                ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-transparent shadow-[0_1px_8px_rgba(99,102,241,.35)]"
                : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.07]"
            }
          `}
        >

          <Icon
            size={14}
            className={
              isActive
                ? "text-white"
                : "text-slate-500"
            }
          />

          {agent.label}

        </button>

      );

    })}


</div>

{

selectedFile && (

<div className="my-3">

<div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">

{

selectedFile.type==="application/pdf"

?

<FileTextIcon

size={16}

className="text-red-400"

/>

:



selectedFile?.type.startsWith("image/")

&&

<img

src={URL.createObjectURL(selectedFile)}

className="h-10 w-10 rounded-xl object-cover mt-3"

/>



}

<div>

<p className="text-xs text-white">

{

selectedFile.name

}

</p>

<p className="text-[10px] text-slate-500">

{

Math.ceil(

selectedFile.size/

1024

)

}

KB

</p>

</div>

<button

onClick={()=>{

setSelectedFile(null);

fileRef.current.value="";

}}

className="ml-2"

>

<X

size={14}

className="text-slate-500 hover:text-white"

/>

</button>

</div>

</div>

)
}

    <textarea
      placeholder="Ask Anything..."
      onChange={(e) => setvalue(e.target.value)}
      value={value}
      className="w-full bg-transparent outline-none resize-none text-[14px] text-slate-200 placeholder:text-slate-600 leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden disabled:opacity-50"
      rows={3}
    />

    <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">

<input
    type="file"
    accept=".pdf,image/*"
    hidden
    ref={fileRef}
    onChange={(e) => {
        const file = e.target.files[0]

        if (file) {
            setSelectedFile(file)
        }
    }}
/>

          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all duration-150 bg-transparent cursor-pointer"
          onClick={() => fileRef.current.click()} 
          >
            <Paperclip size={16} />
          </button>

          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all duration-150 bg-transparent cursor-pointer"
          >
            <Mic size={16} />
          </button>
        </div>

        <button
        disabled={!value.trim}
        onClick={handleSendMessage}
          className={`flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition-all duration-150 ${
  value.trim()
    ? "bg-linear-to-br from-indigo-500 to-violet-700 hover:opacity-90 text-white"
    : "bg-white/[0.05] text-slate-600 cursor-not-allowed"
}`}
        >
          <Send size={15} />
        </button>

    </div>
  </div>
</div>
  )
}

export default ChatInput