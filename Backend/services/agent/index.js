import express from 'express'
import "dotenv/config";
import connectToDB from './lib/db.js'
import router from './routes/agent.routes.js'

const port = process.env.PORT

const app = express()

await connectToDB()

app.use(express.json())

app.use("/",router)

app.use((err,req,res,next) => {
    console.log(err)

    if(err.status){
    return res.status(err.status).json(err.data)
}

return res.status(500).json({message:`agent error ${err}`})
})

app.get("/",(req,res) => {
    res.json({
        message:"Hello from the agent!"
    })
})

app.listen(port,() => {
    console.log(`Agent started at ${port}`)
})