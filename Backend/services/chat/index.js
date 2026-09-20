import express from 'express'
import dotenv from 'dotenv'
import connectToDB from './lib/db.js'
import router from './routes/chat.routes.js'

dotenv.config()

const port = process.env.PORT

const app = express()

await  connectToDB()

app.use(express.json())

app.use("/", router);

app.listen(port,() => {
    console.log(`Chat started at ${port}`)
})