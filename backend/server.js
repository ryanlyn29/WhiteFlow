import express  from 'express'
import redis from './redis.js'
const app = express()
const port = 3000

app.listen (async () => {
    await redis.connect();
})

app.get('/', (req, res) => {
    res.send('Hi Perla')
  })
  
app.listen(port, () => {
    console.log(`Example app listening on port ${3000}`)
})
