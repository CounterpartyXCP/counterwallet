const express = require('express')
const proxy = require('express-http-proxy')

const app = express()

app.use(express.static('src'))
app.use('/_t_api', proxy('http://localhost:14100'))

app.listen(3000)
