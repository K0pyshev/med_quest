const PORT = 8000
const express = require('express')
const cors = require('cors')
const app = express()
app.use(express.json())
app.use(cors())

const LLM_HOST = 'http://127.0.0.1:1234'
const API_HOST = 'http://127.0.0.1:8888'
const API_KEY = 'no-api-key'

app.post('/completions', async (req, res) => {
    const options = {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: req.body.message }],
            max_tokens: 3000,
        })
    }
    try {
        const response = await fetch(`${LLM_HOST}/v1/chat/completions`, options)
        const data = await response.json()
        res.send(data)
    } catch (error) {
        console.error(error)
    };
})

app.post('/context', async (req, res) => {
    try {
        const response = await fetch(`${API_HOST}/question?`+ new URLSearchParams({
            q: req.body.message,
            source: req.body.source,
        }).toString())
        const data = await response.json()
        res.send(data)
    } catch (error) {
        console.error(error)
    };
})

app.listen(PORT, () => console.log('Your server is running on PORT' + PORT))