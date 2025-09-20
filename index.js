const express = require('express')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 3001

app.get('/',(req,res)=>{
    res.send("Hello")
})

app.listen(port,()=>{
    console.log("App is running in "+port)
})
