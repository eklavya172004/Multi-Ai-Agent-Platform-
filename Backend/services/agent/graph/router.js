import { getModel } from "../lib/model.js"

export const router =
async(state)=>{


if (

    state.agent &&

    state.agent !== "auto"

){   

    return {

        ...state,

        agent: state.agent

    };

}


if(state.file){

    if(

        state.file.mimetype.startsWith("image/")

    ){

        return{

            ...state,

            agent:"imageAnalyser"

        };

    }

}

if(state.file){

    if(state.file.mimetype==="application/pdf"){

        return{

            ...state,

            agent:"pdfRag"

        };

    }

}


 const llm = await
 getModel("router");

 const result =
 await llm.invoke(`

You are an agent router.

Available agents:

- chat
- search
- coding
- pdf
- ppt
- vision

Rules:

chat:
General conversation,
explanations,
learning,
questions.

search:
Current events,
latest information,
news,
recent developments,
internet lookup.

coding:
Generate code,
debug code,
build projects,
architecture,
API design.

pdf:
Questions about generate PDFs
or document context.

ppt:
Questions about generate ppts
or ppt context.

vision:
Generate image,
create image

Return ONLY one word:

chat
search
coding
pdf
ppt
vision

User Query:

${state.prompt}

 `);

console.log(result.content)

 return {

  ...state,

  agent:
  result?.content?.trim()?.toLowerCase()

 };

};