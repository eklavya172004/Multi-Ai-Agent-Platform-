import express from 'express'
import dotenv from 'dotenv'
import connectToDB from './lib/db.js'
import router from './routes/billing.routes.js'

dotenv.config()

const port = process.env.PORT

const app = express()

await  connectToDB()

app.use(express.json())

app.use("/",router)

app.get("/",(req,res) => {
    res.json({
        message:"Hello from the auth!!"
    })
})

app.listen(port,() => {
    console.log(`Billing started at ${port}`)
})